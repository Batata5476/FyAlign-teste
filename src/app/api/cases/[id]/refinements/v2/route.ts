import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { CreateRefinementSchema } from '@/lib/types/production';
import { buildServiceOrderNumber, calculateSetupDueAt } from '@/lib/sla/treatment-sla';
import {
  extractIdempotencyKey,
  findIdempotentAuditReplay,
  validateAdditionalOrderPrerequisites,
} from '@/lib/domain/treatment-lifecycle';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };
  const canReadCase = hasPermission(userCtx, 'CASE_READ');
  const canReadContract = hasPermission(userCtx, 'CONTRACT_READ');

  if (!canReadCase && !canReadContract) {
    return NextResponse.json(
      { error: 'Sem permissão CASE_READ ou CONTRACT_READ para listar refinamentos.' },
      { status: 403 }
    );
  }

  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { clinicId: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Anti-IDOR
  if (
    sessionUser.organizationType === 'CLINIC' &&
    clinicalCase.clinicId !== sessionUser.organizationId
  ) {
    return NextResponse.json(
      { error: 'Caso não encontrado ou acesso não autorizado.' },
      { status: 404 }
    );
  }

  const rawRefinements = await prisma.refinementRequest.findMany({
    where: { caseId },
    include: {
      requestedBy: {
        select: { id: true, fullName: true, email: true },
      },
      clinicallyApprovedBy: {
        select: { id: true, fullName: true },
      },
      commerciallyApprovedBy: {
        select: { id: true, fullName: true },
      },
      productionUnits: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const refinements = rawRefinements.map((r) => ({
    id: r.id,
    caseId: r.caseId,
    contractId: canReadContract ? r.contractId : undefined,
    contractVersionUsed: canReadContract ? r.contractVersionUsed : undefined,
    sequenceNumber: r.sequenceNumber,
    clinicalReason: canReadCase ? r.clinicalReason : null, // Redigido para FINANCE (!CASE_READ)
    clinicalStatus: r.clinicalStatus,
    isCoveredByContract: canReadContract ? r.isCoveredByContract : undefined,
    extraAlignersCount: r.extraAlignersCount,
    extraAmountChargedCents: canReadContract ? r.extraAmountChargedCents : undefined,
    commercialStatus: canReadContract ? r.commercialStatus : undefined,
    requestedBy: r.requestedBy,
    clinicallyApprovedBy: r.clinicallyApprovedBy,
    clinicallyApprovedAt: r.clinicallyApprovedAt,
    commerciallyApprovedBy: canReadContract ? r.commerciallyApprovedBy : undefined,
    commerciallyApprovedAt: canReadContract ? r.commerciallyApprovedAt : undefined,
    productionUnits: r.productionUnits,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return NextResponse.json({ refinements });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'REFINEMENT_REQUEST' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      setups: { orderBy: { versionNumber: 'desc' } },
      commercialContract: true,
      refinementRequests: { orderBy: { sequenceNumber: 'asc' } },
      productionUnits: true,
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Anti-IDOR
  if (
    sessionUser.organizationType === 'CLINIC' &&
    clinicalCase.clinicId !== sessionUser.organizationId
  ) {
    return NextResponse.json(
      { error: 'Caso não encontrado ou acesso não autorizado.' },
      { status: 404 }
    );
  }

  // Regra RN-02: Doutor deve estar ativo com CRO Verificado
  if (sessionUser.role === 'DOCTOR' && sessionUser.croStatus !== 'VERIFIED') {
    return NextResponse.json(
      {
        error:
          'Apenas Cirurgiões-Dentistas com CRO verificado podem solicitar refinamentos (RN-02).',
        code: 'CRO_NOT_VERIFIED',
      },
      { status: 403 }
    );
  }

  try {
    const rawBody = await req.json();
    const data = CreateRefinementSchema.parse(rawBody);
    const idempotencyKey = extractIdempotencyKey(req, rawBody);

    const replay = await findIdempotentAuditReplay(prisma, {
      caseId,
      userId: sessionUser.userId,
      action: 'REFINEMENT_REQUESTED_V2',
      idempotencyKey,
    });
    if (replay?.refinementId) {
      const existingRef = await prisma.refinementRequest.findUnique({
        where: { id: replay.refinementId },
      });
      if (existingRef) {
        return NextResponse.json(
          {
            message: 'Refinamento recuperado de forma idempotente.',
            refinement: existingRef,
            idempotentReplay: true,
          },
          { status: 200 }
        );
      }
    }

    // Bloqueio categórico dos 4 pré-requisitos (Setup inicial aprovado + Contrato confirmado)
    const prereq = validateAdditionalOrderPrerequisites(clinicalCase, {
      orderType: 'REFINEMENT',
    });
    if (!prereq.ok) {
      return NextResponse.json(
        { error: prereq.error, code: prereq.code },
        { status: prereq.status || 409 }
      );
    }

    const contract = prereq.contract!;
    const normalizedReason = data.clinicalReason.trim().toLowerCase();

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const existingRefs = await tx.refinementRequest.findMany({
        where: { caseId },
        orderBy: { sequenceNumber: 'asc' },
      });
      const existingOrders = await tx.serviceOrder.findMany({
        where: { caseId },
        orderBy: { sequenceNumber: 'asc' },
      });

      const duplicateOpen = existingOrders.find((so) => {
        if (
          so.type !== 'REFINEMENT' ||
          so.status === 'CANCELLED' ||
          so.status === 'DELIVERED'
        ) {
          return false;
        }
        const linkedRef = existingRefs.find((r) => r.id === so.refinementRequestId);
        return (
          linkedRef &&
          linkedRef.clinicalReason.trim().toLowerCase() === normalizedReason &&
          linkedRef.extraAlignersCount === data.extraAlignersCount
        );
      });

      if (duplicateOpen) {
        const dupErr: any = new Error(
          `Solicitação de refinamento duplicada detectada (${duplicateOpen.orderNumber}).`
        );
        dupErr.httpStatus = 409;
        dupErr.code = 'DUPLICATE_REFINEMENT_REQUEST';
        throw dupErr;
      }

      const sequenceNumber = existingRefs.length + 1;
      const coveredUsedCount = existingRefs.filter((r) => r.isCoveredByContract).length;

      // Avaliação da Política Contratual da Versão Vigente (congelada em contractVersionUsed)
      const isCoveredByContract = coveredUsedCount < contract.includedRefinements;
      let extraAmountChargedCents = 0;
      let commercialStatus = 'APPROVED';

      if (!isCoveredByContract) {
        extraAmountChargedCents = data.extraAlignersCount * contract.extraAlignerPriceCents;
        commercialStatus =
          extraAmountChargedCents > 0 ? 'PENDING_COMMERCIAL_APPROVAL' : 'APPROVED';
      }

      const requiresNewBudget = !isCoveredByContract && extraAmountChargedCents > 0;

      const created = await tx.refinementRequest.create({
        data: {
          caseId,
          contractId: contract.id,
          contractVersionUsed: contract.versionNumber,
          sequenceNumber,
          clinicalReason: data.clinicalReason.trim(),
          clinicalStatus: 'CLINICALLY_APPROVED',
          isCoveredByContract,
          extraAlignersCount: data.extraAlignersCount,
          extraAmountChargedCents,
          commercialStatus,
          requestedById: sessionUser.userId,
          clinicallyApprovedById: sessionUser.userId,
          clinicallyApprovedAt: now,
        },
      });

      const orderSeq = existingOrders.length + 1;
      const order = await tx.serviceOrder.create({
        data: {
          caseId,
          orderNumber: buildServiceOrderNumber(orderSeq, now),
          sequenceNumber: orderSeq,
          type: 'REFINEMENT',
          status: 'RECEIVED',
          title: `Refinamento #${sequenceNumber}`,
          requiresNewBudget,
          nemoStatus: 'PENDING',
          receivedAt: now,
          setupDueAt: calculateSetupDueAt(now, contract.setupSlaBusinessDays || 3),
          refinementRequestId: created.id,
          requestedById: sessionUser.userId,
          notes: data.clinicalReason.trim(),
        },
      });

      await tx.operationalEvent.create({
        data: {
          caseId,
          serviceOrderId: order.id,
          eventType: 'REFINEMENT_OPENED',
          channel: 'PORTAL',
          summary: `Solicitação de Refinamento #${sequenceNumber} aberta para conferência e novo planejamento`,
          details: null,
          isInternalOnly: false,
          recordedById: sessionUser.userId,
          occurredAt: now,
        },
      });

      if (requiresNewBudget) {
        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: order.id,
            eventType: 'COMMERCIAL_NOTE',
            channel: 'INTERNAL',
            summary: `Refinamento #${sequenceNumber} extra-franquia retido para aprovação comercial (${data.extraAlignersCount} pares adicionais)`,
            details: null,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'REFINEMENT_REQUESTED_V2',
          entityAffected: 'RefinementRequest',
          payloadDiff: JSON.stringify({
            idempotencyKey,
            refinementId: created.id,
            serviceOrderId: order.id,
            sequenceNumber,
            isCoveredByContract,
            extraAmountChargedCents,
            commercialStatus,
            contractVersionUsed: contract.versionNumber,
            requestedById: sessionUser.userId,
            receivedAt: now.toISOString(),
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Clinical',
        },
      });

      return { created, sequenceNumber, isCoveredByContract, extraAmountChargedCents };
    });

    return NextResponse.json(
      {
        message: result.isCoveredByContract
          ? `Refinamento #${result.sequenceNumber} registrado com sucesso e coberto pela franquia contratual.`
          : `Refinamento #${result.sequenceNumber} registrado. Custo adicional de R$ ${(result.extraAmountChargedCents / 100).toFixed(2)} requer aprovação comercial.`,
        refinement: result.created,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    if (err?.httpStatus) {
      return NextResponse.json(
        { error: err.message, code: err.code || 'CONFLICT' },
        { status: err.httpStatus }
      );
    }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Conflito de concorrência detectado: refinamento duplicado bloqueado.',
          code: 'CONCURRENT_DUPLICATE_CONFLICT',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Erro ao solicitar refinamento.' },
      { status: 500 }
    );
  }
}
