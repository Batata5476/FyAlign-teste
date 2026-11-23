import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasCommercialAuthority } from '@/lib/auth/rbac';
import { AmendContractSchema } from '@/lib/types/contract';
import {
  extractIdempotencyKey,
  findIdempotentAuditReplay,
  isContractActiveAndConfirmed,
} from '@/lib/domain/treatment-lifecycle';
import { z } from 'zod';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'CONTRACT_AMEND' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  if (!hasCommercialAuthority(sessionUser)) {
    return NextResponse.json(
      { error: 'Apenas responsáveis comerciais autorizados podem registrar aditivos contratuais.' },
      { status: 403 }
    );
  }

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      commercialContract: {
        include: {
          productionUnits: true,
          versions: { orderBy: { versionNumber: 'desc' } },
        },
      },
      shipments: {
        include: { items: true },
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

  if (!isContractActiveAndConfirmed(currentContract)) {
    return NextResponse.json(
      {
        error:
          'Apenas contratos já confirmados podem receber aditivos contratuais. Confirme o contrato inicial antes de emitir um aditivo.',
        code: 'CONTRACT_NOT_CONFIRMED',
      },
      { status: 409 }
    );
  }

  try {
    const rawBody = await req.json();
    const idempotencyKey = extractIdempotencyKey(req, rawBody);

    const replay = await findIdempotentAuditReplay(prisma, {
      caseId,
      userId: sessionUser.userId,
      action: 'CONTRACT_AMENDED',
      idempotencyKey,
    });
    if (replay?.newVersion) {
      return NextResponse.json(
        {
          message: `Aditivo contratual recuperado de forma idempotente (Versão ${currentContract.versionNumber}).`,
          contract: currentContract,
          idempotentReplay: true,
        },
        { status: 200 }
      );
    }

    const data = AmendContractSchema.parse(rawBody);

    // Invariante P-02: Não permitir reduzir a quantidade contratada abaixo do que já foi produzido ou expedido
    const totalProduced = currentContract.productionUnits
      .filter((u) => ['QC_PASSED', 'SHIPPED'].includes(u.status))
      .reduce((acc, u) => acc + u.quantityPairs, 0);

    const totalShipped = currentContract.productionUnits.reduce(
      (acc, u) => acc + u.shippedQuantity,
      0
    );

    const maxAlreadyCommitted = Math.max(totalProduced, totalShipped);

    if (
      data.contractedAligners !== undefined &&
      data.contractedAligners < maxAlreadyCommitted
    ) {
      return NextResponse.json(
        {
          error: `Invariante violada: Não é permitido reduzir a quantidade contratada para ${data.contractedAligners} pares, pois já existem ${maxAlreadyCommitted} pares produzidos ou expedidos (Invariante P-02).`,
        },
        { status: 400 }
      );
    }

    const nextVersionNumber = currentContract.versionNumber + 1;
    const now = new Date();

    // INVARIANTE DE INTEGRIDADE COMERCIAL RETROATIVA:
    // Aditivos atualizam APENAS CaseCommercialContract + ContractVersion daqui em diante.
    // Jamais reescrevem RefinementRequest.isCoveredByContract, contractVersionUsed, extraAmountChargedCents ou ServiceOrders já abertas!
    const result = await prisma.$transaction(async (tx) => {
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
        amendedAt: now.toISOString(),
      });

      await tx.contractVersion.create({
        data: {
          contractId: currentContract.id,
          versionNumber: nextVersionNumber,
          contractedAligners:
            data.contractedAligners ?? currentContract.contractedAligners,
          totalPriceCents: data.totalPriceCents ?? currentContract.totalPriceCents,
          productionModel: data.productionModel ?? currentContract.productionModel,
          deliveryModel: data.deliveryModel ?? currentContract.deliveryModel,
          includedRefinements:
            data.includedRefinements ?? currentContract.includedRefinements,
          refinementWindowDays:
            data.refinementWindowDays ?? currentContract.refinementWindowDays,
          extraAlignerPriceCents:
            data.extraAlignerPriceCents ?? currentContract.extraAlignerPriceCents,
          setupSlaBusinessDays:
            data.setupSlaBusinessDays ?? currentContract.setupSlaBusinessDays,
          productionSlaDays: data.productionSlaDays ?? currentContract.productionSlaDays,
          productionSlaDayType:
            data.productionSlaDayType ?? currentContract.productionSlaDayType,
          snapshotJson,
          changeReason: data.changeReason,
          changedById: sessionUser.userId,
        },
      });

      const updatedContract = await tx.caseCommercialContract.update({
        where: { id: currentContract.id },
        data: {
          versionNumber: nextVersionNumber,
          status: 'AMENDED',
          contractedAligners:
            data.contractedAligners ?? currentContract.contractedAligners,
          totalPriceCents: data.totalPriceCents ?? currentContract.totalPriceCents,
          productionModel: data.productionModel ?? currentContract.productionModel,
          deliveryModel: data.deliveryModel ?? currentContract.deliveryModel,
          includedRefinements:
            data.includedRefinements ?? currentContract.includedRefinements,
          refinementWindowDays:
            data.refinementWindowDays ?? currentContract.refinementWindowDays,
          extraAlignerPriceCents:
            data.extraAlignerPriceCents ?? currentContract.extraAlignerPriceCents,
          setupSlaBusinessDays:
            data.setupSlaBusinessDays ?? currentContract.setupSlaBusinessDays,
          productionSlaDays: data.productionSlaDays ?? currentContract.productionSlaDays,
          productionSlaDayType:
            data.productionSlaDayType ?? currentContract.productionSlaDayType,
          commercialNotes:
            data.commercialNotes !== undefined
              ? data.commercialNotes
              : currentContract.commercialNotes,
        },
      });

      await tx.operationalEvent.create({
        data: {
          caseId,
          eventType: 'CONTRACT_AMENDED',
          channel: 'INTERNAL',
          summary: `Aditivo contratual v${nextVersionNumber} registrado (${updatedContract.contractedAligners} pares)`,
          details: data.changeReason,
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
          action: 'CONTRACT_AMENDED',
          entityAffected: 'CaseCommercialContract',
          payloadDiff: JSON.stringify({
            idempotencyKey,
            previousVersion: currentContract.versionNumber,
            newVersion: nextVersionNumber,
            changeReason: data.changeReason,
            changedById: sessionUser.userId,
            diff: {
              contractedAligners: data.contractedAligners,
              totalPriceCents: data.totalPriceCents,
              includedRefinements: data.includedRefinements,
              extraAlignerPriceCents: data.extraAlignerPriceCents,
            },
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Backend',
        },
      });

      return updatedContract;
    });

    return NextResponse.json({
      message: `Aditivo contratual registrado com sucesso (Versão ${nextVersionNumber}).`,
      contract: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err.message || 'Erro ao registrar aditivo.' },
      { status: 500 }
    );
  }
}
