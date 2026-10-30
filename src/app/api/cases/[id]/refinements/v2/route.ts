import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { CreateRefinementSchema } from '@/lib/types/production';
import { buildServiceOrderNumber, calculateSetupDueAt } from '@/lib/sla/treatment-sla';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'CASE_READ' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { clinicId: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Anti-IDOR
  if (sessionUser.organizationType === 'CLINIC' && clinicalCase.clinicId !== sessionUser.organizationId) {
    return NextResponse.json({ error: 'Caso não encontrado ou acesso não autorizado.' }, { status: 404 });
  }

  const refinements = await prisma.refinementRequest.findMany({
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
      commercialContract: true,
      refinementRequests: true,
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Anti-IDOR
  if (sessionUser.organizationType === 'CLINIC' && clinicalCase.clinicId !== sessionUser.organizationId) {
    return NextResponse.json({ error: 'Caso não encontrado ou acesso não autorizado.' }, { status: 404 });
  }

  // Regra RN-02: Doutor deve estar ativo com CRO Verificado
  if (sessionUser.role === 'DOCTOR' && sessionUser.croStatus !== 'VERIFIED') {
    return NextResponse.json(
      { error: 'Apenas Cirurgiões-Dentistas com CRO verificado podem solicitar refinamentos (RN-02).' },
      { status: 403 }
    );
  }

  if (!clinicalCase.commercialContract) {
    return NextResponse.json(
      { error: 'Não é possível solicitar refinamento sem um contrato comercial confirmado associado ao caso.' },
      { status: 400 }
    );
  }

  const contract = clinicalCase.commercialContract;

  try {
    const body = await req.json();
    const data = CreateRefinementSchema.parse(body);

    const existingRefinementsCount = clinicalCase.refinementRequests.length;
    const sequenceNumber = existingRefinementsCount + 1;

    // Avaliação da Política Contratual da Versão Vigente (Invariante RF-01 / RF-02)
    const isCoveredByContract = existingRefinementsCount < contract.includedRefinements;
    let extraAmountChargedCents = 0;
    let commercialStatus = 'APPROVED';

    if (!isCoveredByContract) {
      extraAmountChargedCents = data.extraAlignersCount * contract.extraAlignerPriceCents;
      commercialStatus = extraAmountChargedCents > 0 ? 'PENDING_COMMERCIAL_APPROVAL' : 'APPROVED';
    }

    const refinement = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.refinementRequest.create({
        data: {
          caseId,
          contractId: contract.id,
          contractVersionUsed: contract.versionNumber,
          sequenceNumber,
          clinicalReason: data.clinicalReason,
          clinicalStatus: 'CLINICALLY_APPROVED', // Solicitado formalmente pelo doutor
          isCoveredByContract,
          extraAlignersCount: data.extraAlignersCount,
          extraAmountChargedCents,
          commercialStatus,
          requestedById: sessionUser.userId,
          clinicallyApprovedById: sessionUser.userId,
          clinicallyApprovedAt: now,
        },
      });

      const orderCount = await tx.serviceOrder.count({ where: { caseId } });
      await tx.serviceOrder.create({
        data: {
          caseId,
          orderNumber: buildServiceOrderNumber(orderCount + 1, now),
          sequenceNumber: orderCount + 1,
          type: 'REFINEMENT',
          status: 'RECEIVED',
          title: `Refinamento #${sequenceNumber}${isCoveredByContract ? ' (Franquia Contratual)' : ' (Extra-Franquia)'}`,
          requiresNewBudget: !isCoveredByContract && extraAmountChargedCents > 0,
          nemoStatus: 'PENDING',
          receivedAt: now,
          setupDueAt: calculateSetupDueAt(now, contract.setupSlaBusinessDays || 3),
          refinementRequestId: created.id,
          requestedById: sessionUser.userId,
          notes: data.clinicalReason,
        },
      });

      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'REFINEMENT_REQUESTED_V2',
          entityAffected: 'RefinementRequest',
          payloadDiff: JSON.stringify({
            refinementId: created.id,
            sequenceNumber,
            isCoveredByContract,
            extraAmountChargedCents,
            commercialStatus,
            contractVersionUsed: contract.versionNumber,
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Clinical',
        },
      });

      return created;
    });

    return NextResponse.json({
      message: isCoveredByContract
        ? `Refinamento #${sequenceNumber} registrado com sucesso e coberto pela franquia contratual.`
        : `Refinamento #${sequenceNumber} registrado. Custo adicional de R$ ${(extraAmountChargedCents / 100).toFixed(2)} requer aprovação comercial.`,
      refinement,
    }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro ao solicitar refinamento.' }, { status: 500 });
  }
}
