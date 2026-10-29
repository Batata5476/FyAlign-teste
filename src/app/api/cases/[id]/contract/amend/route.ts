import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasCommercialAuthority } from '@/lib/auth/rbac';
import { AmendContractSchema } from '@/lib/types/contract';
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
    return NextResponse.json({ error: 'Contrato comercial não encontrado para este caso.' }, { status: 404 });
  }

  const currentContract = clinicalCase.commercialContract;

  try {
    const body = await req.json();
    const data = AmendContractSchema.parse(body);

    // Invariante P-02: Não permitir reduzir a quantidade contratada abaixo do que já foi produzido ou expedido
    const totalProduced = currentContract.productionUnits
      .filter((u) => ['QC_PASSED', 'SHIPPED'].includes(u.status))
      .reduce((acc, u) => acc + u.quantityPairs, 0);

    const totalShipped = currentContract.productionUnits.reduce((acc, u) => acc + u.shippedQuantity, 0);

    const maxAlreadyCommitted = Math.max(totalProduced, totalShipped);

    if (data.contractedAligners !== undefined && data.contractedAligners < maxAlreadyCommitted) {
      return NextResponse.json(
        {
          error: `Invariante violada: Não é permitido reduzir a quantidade contratada para ${data.contractedAligners} pares, pois já existem ${maxAlreadyCommitted} pares produzidos ou expedidos (Invariante P-02).`,
        },
        { status: 400 }
      );
    }

    const nextVersionNumber = currentContract.versionNumber + 1;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Snapshot da versão anterior
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
          contractedAligners: data.contractedAligners ?? currentContract.contractedAligners,
          totalPriceCents: data.totalPriceCents ?? currentContract.totalPriceCents,
          productionModel: data.productionModel ?? currentContract.productionModel,
          deliveryModel: data.deliveryModel ?? currentContract.deliveryModel,
          includedRefinements: data.includedRefinements ?? currentContract.includedRefinements,
          refinementWindowDays: data.refinementWindowDays ?? currentContract.refinementWindowDays,
          extraAlignerPriceCents: data.extraAlignerPriceCents ?? currentContract.extraAlignerPriceCents,
          snapshotJson,
          changeReason: data.changeReason,
          changedById: sessionUser.userId,
        },
      });

      // 2. Atualizar contrato com a nova versão vigente
      const updatedContract = await tx.caseCommercialContract.update({
        where: { id: currentContract.id },
        data: {
          versionNumber: nextVersionNumber,
          status: 'AMENDED',
          contractedAligners: data.contractedAligners ?? currentContract.contractedAligners,
          totalPriceCents: data.totalPriceCents ?? currentContract.totalPriceCents,
          productionModel: data.productionModel ?? currentContract.productionModel,
          deliveryModel: data.deliveryModel ?? currentContract.deliveryModel,
          includedRefinements: data.includedRefinements ?? currentContract.includedRefinements,
          refinementWindowDays: data.refinementWindowDays ?? currentContract.refinementWindowDays,
          extraAlignerPriceCents: data.extraAlignerPriceCents ?? currentContract.extraAlignerPriceCents,
          commercialNotes: data.commercialNotes !== undefined ? data.commercialNotes : currentContract.commercialNotes,
        },
      });

      // 3. Auditoria
      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'CONTRACT_AMENDED',
          entityAffected: 'CaseCommercialContract',
          payloadDiff: JSON.stringify({
            previousVersion: currentContract.versionNumber,
            newVersion: nextVersionNumber,
            changeReason: data.changeReason,
            diff: {
              contractedAligners: data.contractedAligners,
              totalPriceCents: data.totalPriceCents,
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
    return NextResponse.json({ error: err.message || 'Erro ao registrar aditivo.' }, { status: 500 });
  }
}
