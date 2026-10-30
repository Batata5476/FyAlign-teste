import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import {
  buildServiceOrderNumber,
  calculateSecondBatchPrepDueAt,
  calculateSetupDueAt,
  estimateBatchEndDate,
  evaluateSlaStatus,
} from '@/lib/sla/treatment-sla';

const createServiceOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INITIAL'),
    title: z.string().min(3).optional(),
    alignerRangeStart: z.number().int().positive().optional(),
    alignerRangeEnd: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    type: z.literal('SECOND_BATCH'),
    title: z.string().min(3).optional(),
    alignerRangeStart: z.number().int().positive(),
    alignerRangeEnd: z.number().int().positive(),
    mode: z.enum(['SCHEDULED', 'IMMEDIATE']).default('IMMEDIATE'),
    previousBatchEndDate: z.string().optional(),
    createProductionUnit: z.boolean().default(true),
    notes: z.string().optional(),
  }),
  z.object({
    type: z.literal('REFINEMENT'),
    clinicalReason: z.string().min(5, 'Descreva o motivo clínico do refinamento (mín. 5 caracteres)'),
    extraAlignersCount: z.number().int().min(0).default(0),
    notes: z.string().optional(),
  }),
]);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const orders = await prisma.serviceOrder.findMany({
    where: { caseId },
    include: {
      requestedBy: { select: { id: true, fullName: true } },
      docsVerifiedBy: { select: { id: true, fullName: true } },
      nemoInsertedBy: { select: { id: true, fullName: true } },
      productionReleasedBy: { select: { id: true, fullName: true } },
      refinementRequest: true,
      externalLinks: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const now = new Date();
  const enriched = orders.map((order) => ({
    ...order,
    setupSla: evaluateSlaStatus(order.setupDueAt, order.setupSentAt, now),
    productionSla: evaluateSlaStatus(order.productionDueAt, order.completedAt, now),
    prepScheduleSla: evaluateSlaStatus(
      order.scheduledPrepAt,
      order.productionReleasedAt || order.completedAt,
      now
    ),
  }));

  return NextResponse.json({ serviceOrders: enriched });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  // Autorização base no Caso/Tratamento (com proteção anti-IDOR Cross-Tenant)
  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };

  try {
    const rawBody = await req.json();
    const input = createServiceOrderSchema.parse(rawBody);

    const treatment = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        commercialContract: true,
        refinementRequests: true,
        productionUnits: true,
        serviceOrders: { orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!treatment) {
      return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
    }

    const now = new Date();
    const nextSequence = treatment.serviceOrders.length + 1;
    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'FyAlign/FaseB';

    // ========================================================================
    // 1. SEGUNDA LEVA (Execução Operacional Programada — Sem Novo Setup/Orçamento)
    // ========================================================================
    if (input.type === 'SECOND_BATCH') {
      const canTriggerSecondBatch =
        hasPermission(userCtx, 'PRODUCTION_UNIT_MANAGE') ||
        hasPermission(userCtx, 'PRODUCTION_RELEASE') ||
        hasPermission(userCtx, 'CASE_CREATE') ||
        hasPermission(userCtx, 'CASE_UPDATE');

      if (!canTriggerSecondBatch) {
        return NextResponse.json(
          { error: 'Sem permissão para programar ou solicitar Segunda Leva deste tratamento.' },
          { status: 403 }
        );
      }

      if (input.alignerRangeEnd < input.alignerRangeStart) {
        return NextResponse.json(
          { error: 'O alinhador final da leva deve ser maior ou igual ao inicial.' },
          { status: 400 }
        );
      }

      const quantityPairs = input.alignerRangeEnd - input.alignerRangeStart + 1;
      const estimatedPrevEnd = input.previousBatchEndDate
        ? new Date(input.previousBatchEndDate)
        : estimateBatchEndDate(treatment.approvedAt || treatment.createdAt, Math.max(1, input.alignerRangeStart - 1));

      const scheduledPrepAt = calculateSecondBatchPrepDueAt(estimatedPrevEnd, 30);
      const isImmediate = input.mode === 'IMMEDIATE';

      const created = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.create({
          data: {
            caseId,
            orderNumber: buildServiceOrderNumber(nextSequence, now),
            sequenceNumber: nextSequence,
            type: 'SECOND_BATCH',
            status: isImmediate ? 'RELEASED_FOR_PRODUCTION' : 'SCHEDULED',
            title:
              input.title ||
              `Segunda Leva — Alinhadores ${input.alignerRangeStart}–${input.alignerRangeEnd}`,
            alignerRangeStart: input.alignerRangeStart,
            alignerRangeEnd: input.alignerRangeEnd,
            requiresNewBudget: false,
            nemoStatus: 'NOT_REQUIRED',
            receivedAt: now,
            scheduledPrepAt,
            productionReleasedAt: isImmediate ? now : null,
            productionReleasedById: isImmediate ? sessionUser.userId : null,
            requestedById: sessionUser.userId,
            notes: input.notes || null,
          },
        });

        let createdUnit = null;
        if (input.createProductionUnit && treatment.commercialContract) {
          const existingPairs = treatment.productionUnits.reduce(
            (sum, u) => sum + u.quantityPairs,
            0
          );
          if (existingPairs + quantityPairs <= treatment.commercialContract.contractedAligners) {
            const unitSeq = treatment.productionUnits.length + 1;
            createdUnit = await tx.productionUnit.create({
              data: {
                caseId,
                contractId: treatment.commercialContract.id,
                unitCode: `LOTE-${String(unitSeq).padStart(2, '0')}`,
                type: 'BATCH',
                quantityPairs,
                stagesDescription: `Segunda Leva: Estágios ${input.alignerRangeStart} a ${input.alignerRangeEnd}`,
                status: isImmediate ? 'IN_PRODUCTION' : 'PENDING',
                plannedStartDate: isImmediate ? now : scheduledPrepAt,
              },
            });
          }
        }

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: order.id,
            eventType: 'SECOND_BATCH_TRIGGERED',
            channel: 'INTERNAL',
            summary: isImmediate
              ? `Segunda Leva (${input.alignerRangeStart}–${input.alignerRangeEnd}) liberada para preparação fabril`
              : `Segunda Leva (${input.alignerRangeStart}–${input.alignerRangeEnd}) programada para ${scheduledPrepAt.toLocaleDateString('pt-BR')}`,
            details: input.notes || null,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_SECOND_BATCH_CREATED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              serviceOrderId: order.id,
              orderNumber: order.orderNumber,
              alignerRange: `${input.alignerRangeStart}-${input.alignerRangeEnd}`,
              mode: input.mode,
              productionUnitId: createdUnit?.id || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return { order, productionUnit: createdUnit };
      });

      return NextResponse.json(
        {
          message: 'Solicitação de Segunda Leva registrada com sucesso (sem novo orçamento).',
          serviceOrder: created.order,
          productionUnit: created.productionUnit,
        },
        { status: 201 }
      );
    }

    // ========================================================================
    // 2. REFINAMENTO (Nova Solicitação Clínica no Mesmo Tratamento)
    // ========================================================================
    if (input.type === 'REFINEMENT') {
      if (!hasPermission(userCtx, 'REFINEMENT_REQUEST')) {
        return NextResponse.json(
          { error: 'Sem permissão REFINEMENT_REQUEST para solicitar refinamento.' },
          { status: 403 }
        );
      }

      if (sessionUser.role === 'DOCTOR' && sessionUser.croStatus !== 'VERIFIED') {
        return NextResponse.json(
          { error: 'Apenas Cirurgiões-Dentistas com CRO verificado podem solicitar refinamento (RN-02).' },
          { status: 403 }
        );
      }

      const contract = treatment.commercialContract;
      const existingRefCount = treatment.refinementRequests.length;
      const refSequence = existingRefCount + 1;

      const isCoveredByContract = contract
        ? existingRefCount < contract.includedRefinements
        : true;
      const extraPricePerPair = contract?.extraAlignerPriceCents ?? 0;
      const extraAmountChargedCents = isCoveredByContract
        ? 0
        : input.extraAlignersCount * extraPricePerPair;
      const requiresNewBudget = !isCoveredByContract && extraAmountChargedCents > 0;

      const created = await prisma.$transaction(async (tx) => {
        let refinementRecord = null;
        if (contract) {
          refinementRecord = await tx.refinementRequest.create({
            data: {
              caseId,
              contractId: contract.id,
              contractVersionUsed: contract.versionNumber,
              sequenceNumber: refSequence,
              clinicalReason: input.clinicalReason,
              clinicalStatus: 'CLINICALLY_APPROVED',
              isCoveredByContract,
              extraAlignersCount: input.extraAlignersCount,
              extraAmountChargedCents,
              commercialStatus: requiresNewBudget ? 'PENDING_COMMERCIAL_APPROVAL' : 'APPROVED',
              requestedById: sessionUser.userId,
              clinicallyApprovedById: sessionUser.userId,
              clinicallyApprovedAt: now,
            },
          });
        }

        const setupDueAt = calculateSetupDueAt(now, contract?.setupSlaBusinessDays || 3);

        const order = await tx.serviceOrder.create({
          data: {
            caseId,
            orderNumber: buildServiceOrderNumber(nextSequence, now),
            sequenceNumber: nextSequence,
            type: 'REFINEMENT',
            status: 'RECEIVED',
            title: `Refinamento #${refSequence}${isCoveredByContract ? ' (Coberto pelo Plano)' : ' (Adicional)'}`,
            requiresNewBudget,
            nemoStatus: 'PENDING',
            receivedAt: now,
            setupDueAt,
            refinementRequestId: refinementRecord?.id || null,
            requestedById: sessionUser.userId,
            notes: input.notes || input.clinicalReason,
          },
        });

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: order.id,
            eventType: 'COMMERCIAL_NOTE',
            channel: 'PORTAL',
            summary: `OS de Refinamento #${refSequence} aberta (${isCoveredByContract ? 'sem novo orçamento' : 'extra-franquia'})`,
            details: input.clinicalReason,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_REFINEMENT_CREATED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              serviceOrderId: order.id,
              refinementId: refinementRecord?.id || null,
              isCoveredByContract,
              requiresNewBudget,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return { order, refinement: refinementRecord };
      });

      return NextResponse.json(
        {
          message: `Solicitação de Refinamento #${refSequence} registrada no tratamento.`,
          serviceOrder: created.order,
          refinement: created.refinement,
        },
        { status: 201 }
      );
    }

    // ========================================================================
    // 3. PEDIDO INICIAL (Caso ainda não exista OS inicial formalizada)
    // ========================================================================
    if (!hasPermission(userCtx, 'CASE_CREATE') && !hasPermission(userCtx, 'SUBMIT_CASE')) {
      return NextResponse.json(
        { error: 'Sem permissão para criar OS de Pedido Inicial.' },
        { status: 403 }
      );
    }

    const setupDueAt = calculateSetupDueAt(
      now,
      treatment.commercialContract?.setupSlaBusinessDays || 3
    );

    const initialOrder = await prisma.serviceOrder.create({
      data: {
        caseId,
        orderNumber: buildServiceOrderNumber(nextSequence, now),
        sequenceNumber: nextSequence,
        type: 'INITIAL',
        status: 'RECEIVED',
        title: input.title || 'Pedido Inicial — Planejamento & 1ª Leva',
        alignerRangeStart: input.alignerRangeStart ?? null,
        alignerRangeEnd: input.alignerRangeEnd ?? null,
        requiresNewBudget: true,
        nemoStatus: 'PENDING',
        receivedAt: now,
        setupDueAt,
        requestedById: sessionUser.userId,
        notes: input.notes || null,
      },
    });

    return NextResponse.json(
      {
        message: 'OS de Pedido Inicial criada com sucesso.',
        serviceOrder: initialOrder,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro em POST /service-orders:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao registrar solicitação operacional.' },
      { status: 500 }
    );
  }
}
