import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasCommercialAuthority } from '@/lib/auth/rbac';
import { CreateContractSchema } from '@/lib/types/contract';
import { calculateProductionDueAt } from '@/lib/sla/treatment-sla';
import {
  extractIdempotencyKey,
  findIdempotentAuditReplay,
  isContractActiveAndConfirmed,
} from '@/lib/domain/treatment-lifecycle';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'CONTRACT_READ' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { clinicId: true, caseCode: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Anti-IDOR: Usuários de clínicas só acessam casos da sua própria clínica
  if (
    sessionUser.organizationType === 'CLINIC' &&
    clinicalCase.clinicId !== sessionUser.organizationId
  ) {
    return NextResponse.json(
      { error: 'Caso não encontrado ou acesso não autorizado.' },
      { status: 404 }
    );
  }

  const contract = await prisma.caseCommercialContract.findUnique({
    where: { caseId },
    include: {
      versions: {
        include: {
          changedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { versionNumber: 'desc' },
      },
      confirmedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  return NextResponse.json({ contract });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'CONTRACT_CREATE' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { commercialContract: true },
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

  try {
    const rawBody = await req.json();
    const idempotencyKey = extractIdempotencyKey(req, rawBody);

    const replay = await findIdempotentAuditReplay(prisma, {
      caseId,
      userId: sessionUser.userId,
      action: 'CONTRACT_PROPOSED',
      idempotencyKey,
    });
    if (replay?.contractId && clinicalCase.commercialContract) {
      return NextResponse.json(
        { contract: clinicalCase.commercialContract, idempotentReplay: true },
        { status: 200 }
      );
    }

    if (clinicalCase.commercialContract) {
      return NextResponse.json(
        { error: 'Este caso clínico já possui um contrato comercial associado (Invariante 1).' },
        { status: 400 }
      );
    }

    const data = CreateContractSchema.parse(rawBody);

    const now = new Date();
    const year = now.getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractCode = `CTR-${year}-${randomSuffix}`;
    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'FyAlign/Backend';

    const newContract = await prisma.$transaction(async (tx) => {
      const created = await tx.caseCommercialContract.create({
        data: {
          caseId,
          contractCode,
          packageName: data.packageName,
          contractedAligners: data.contractedAligners,
          totalPriceCents: data.totalPriceCents,
          currency: data.currency,
          productionModel: data.productionModel,
          deliveryModel: data.deliveryModel,
          includedRefinements: data.includedRefinements,
          refinementWindowDays: data.refinementWindowDays,
          extraAlignerPriceCents: data.extraAlignerPriceCents,
          setupSlaBusinessDays: data.setupSlaBusinessDays,
          productionSlaDays: data.productionSlaDays,
          productionSlaDayType: data.productionSlaDayType,
          commercialNotes: data.commercialNotes || null,
          status: 'DRAFT',
        },
      });

      await tx.operationalEvent.create({
        data: {
          caseId,
          eventType: 'CONTRACT_PROPOSED',
          channel: 'INTERNAL',
          summary: `Proposta comercial ${contractCode} emitida (${data.packageName} — ${data.contractedAligners} pares)`,
          details: data.commercialNotes || null,
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
          action: 'CONTRACT_PROPOSED',
          entityAffected: 'CaseCommercialContract',
          payloadDiff: JSON.stringify({
            idempotencyKey,
            contractId: created.id,
            contractCode,
            packageName: data.packageName,
            contractedAligners: data.contractedAligners,
            totalPriceCents: data.totalPriceCents,
            proposedById: sessionUser.userId,
          }),
          ipAddress: clientIp,
          userAgent,
        },
      });

      return created;
    });

    return NextResponse.json({ contract: newContract }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Este caso já possui proposta contratual em processamento.', code: 'DUPLICATE_CONTRACT' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Erro ao criar contrato.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'CONTRACT_CONFIRM' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  // Invariante: Apenas membros com autoridade comercial na organização FYALIGN podem confirmar
  if (!hasCommercialAuthority(sessionUser)) {
    return NextResponse.json(
      { error: 'Apenas responsáveis comerciais autorizados podem confirmar contratos (Regra 01).' },
      { status: 403 }
    );
  }

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      commercialContract: {
        include: { versions: true },
      },
      setups: {
        where: { status: 'APPROVED' },
        take: 1,
      },
    },
  });

  if (!clinicalCase || !clinicalCase.commercialContract) {
    return NextResponse.json(
      { error: 'Contrato comercial não encontrado para este caso.' },
      { status: 404 }
    );
  }

  const currentContract = clinicalCase.commercialContract;

  if (isContractActiveAndConfirmed(currentContract)) {
    return NextResponse.json(
      {
        message: 'Contrato já confirmado anteriormente.',
        contract: currentContract,
        idempotentReplay: true,
      },
      { status: 200 }
    );
  }

  if (currentContract.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'Contrato cancelado não pode ser confirmado.' },
      { status: 400 }
    );
  }

  // Operação Atômica: Confirmação + Version 1 Snapshot + Avaliação do Gatilho de Produção + Eventos/Auditoria
  const now = new Date();
  const confirmedContract = await prisma.$transaction(async (tx) => {
    const updated = await tx.caseCommercialContract.update({
      where: { id: currentContract.id },
      data: {
        status: 'CONFIRMED',
        confirmedById: sessionUser.userId,
        confirmedAt: now,
      },
    });

    const snapshotJson = JSON.stringify({
      contractCode: currentContract.contractCode,
      packageName: currentContract.packageName,
      contractedAligners: currentContract.contractedAligners,
      totalPriceCents: currentContract.totalPriceCents,
      productionModel: currentContract.productionModel,
      deliveryModel: currentContract.deliveryModel,
      includedRefinements: currentContract.includedRefinements,
      refinementWindowDays: currentContract.refinementWindowDays,
      extraAlignerPriceCents: currentContract.extraAlignerPriceCents,
      commercialNotes: currentContract.commercialNotes,
      confirmedAt: now.toISOString(),
      confirmedBy: sessionUser.userId,
    });

    await tx.contractVersion.create({
      data: {
        contractId: currentContract.id,
        versionNumber: 1,
        contractedAligners: currentContract.contractedAligners,
        totalPriceCents: currentContract.totalPriceCents,
        productionModel: currentContract.productionModel,
        deliveryModel: currentContract.deliveryModel,
        includedRefinements: currentContract.includedRefinements,
        refinementWindowDays: currentContract.refinementWindowDays,
        extraAlignerPriceCents: currentContract.extraAlignerPriceCents,
        setupSlaBusinessDays: currentContract.setupSlaBusinessDays,
        productionSlaDays: currentContract.productionSlaDays,
        productionSlaDayType: currentContract.productionSlaDayType,
        snapshotJson,
        changeReason: 'Confirmação comercial inicial do contrato.',
        changedById: sessionUser.userId,
      },
    });

    // Gatilho de Produção: Se o Setup Clínico já estiver APROVADO, liberar para IN_PRODUCTION + calcular SLA
    const hasApprovedSetup = clinicalCase.setups.length > 0;
    if (
      hasApprovedSetup &&
      ['APPROVED', 'CAD_DESIGN', 'WAITING_DOCTOR_APPROVAL'].includes(clinicalCase.status)
    ) {
      await tx.case.update({
        where: { id: caseId },
        data: { status: 'IN_PRODUCTION' },
      });

      const activeInitialOrder = await tx.serviceOrder.findFirst({
        where: {
          caseId,
          type: 'INITIAL',
          status: { notIn: ['DELIVERED', 'CANCELLED'] },
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (activeInitialOrder) {
        const productionDueAt = calculateProductionDueAt(now, {
          days: currentContract.productionSlaDays,
          dayType: currentContract.productionSlaDayType,
        });
        await tx.serviceOrder.update({
          where: { id: activeInitialOrder.id },
          data: {
            approvedAt: activeInitialOrder.approvedAt || now,
            productionDueAt,
            productionReleasedAt: activeInitialOrder.productionReleasedAt || now,
            productionReleasedById:
              activeInitialOrder.productionReleasedById || sessionUser.userId,
            status: 'RELEASED_FOR_PRODUCTION',
          },
        });
      }
    }

    await tx.operationalEvent.create({
      data: {
        caseId,
        eventType: 'CONTRACT_CONFIRMED',
        channel: 'INTERNAL',
        summary: `Contrato comercial ${currentContract.contractCode} confirmado pelo Financeiro (v1)`,
        details: hasApprovedSetup
          ? 'Gatilho duplo atendido (Setup aprovado + Contrato confirmado) — produção liberada.'
          : 'Aguardando aprovação clínica do Setup pelo ortodontista para liberar manufatura.',
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
        action: 'CONTRACT_CONFIRMED',
        entityAffected: 'CaseCommercialContract',
        payloadDiff: JSON.stringify({
          contractId: currentContract.id,
          contractCode: currentContract.contractCode,
          totalPriceCents: currentContract.totalPriceCents,
          contractedAligners: currentContract.contractedAligners,
          confirmedById: sessionUser.userId,
          confirmedAt: now.toISOString(),
          hasApprovedSetup,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Backend',
      },
    });

    return updated;
  });

  return NextResponse.json({
    message: 'Contrato comercial confirmado com sucesso.',
    contract: confirmedContract,
  });
}
