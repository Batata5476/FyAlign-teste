import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { CreateProductionUnitSchema } from '@/lib/types/production';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'PRODUCTION_UNIT_READ' });
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

  const units = await prisma.productionUnit.findMany({
    where: { caseId },
    include: {
      qcApprovedBy: {
        select: { id: true, fullName: true },
      },
      shipmentItems: {
        include: {
          shipment: {
            select: { id: true, shipmentCode: true, status: true, trackingCode: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ units });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'PRODUCTION_UNIT_MANAGE' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      commercialContract: {
        include: {
          productionUnits: true,
        },
      },
      refinementRequests: true,
    },
  });

  if (!clinicalCase || !clinicalCase.commercialContract) {
    return NextResponse.json(
      { error: 'Caso não possui contrato comercial confirmado. Liberação de produção bloqueada (Invariante CT-01).' },
      { status: 400 }
    );
  }

  const contract = clinicalCase.commercialContract;
  if (contract.status !== 'CONFIRMED' && contract.status !== 'AMENDED') {
    return NextResponse.json(
      { error: `Produção não pode ser iniciada: Contrato está em estado '${contract.status}', exige 'CONFIRMED' (Invariante CT-01).` },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const data = CreateProductionUnitSchema.parse(body);

    // Validação quantitativa: Unidades regulares não podem exceder a quantidade contratada
    if (!data.refinementRequestId) {
      const existingRegularPairs = contract.productionUnits
        .filter((u) => !u.refinementRequestId)
        .reduce((sum, u) => sum + u.quantityPairs, 0);

      const totalAfterNew = existingRegularPairs + data.quantityPairs;
      if (totalAfterNew > contract.contractedAligners) {
        return NextResponse.json(
          {
            error: `Invariante violada: Total de pares em produção (${totalAfterNew}) excederia a quantidade contratada (${contract.contractedAligners}).`,
          },
          { status: 400 }
        );
      }
    } else {
      // Se for de refinamento, validar se o refinamento existe e está aprovado comercialmente
      const refinement = clinicalCase.refinementRequests.find((r) => r.id === data.refinementRequestId);
      if (!refinement) {
        return NextResponse.json({ error: 'Solicitação de refinamento não encontrada.' }, { status: 404 });
      }
      if (refinement.commercialStatus !== 'APPROVED' && refinement.commercialStatus !== 'COMMERCIALLY_APPROVED') {
        return NextResponse.json(
          { error: `Produção adicional bloqueada: Refinamento aguarda aprovação comercial (Invariante RF-03).` },
          { status: 400 }
        );
      }
    }

    const unit = await prisma.$transaction(async (tx) => {
      const created = await tx.productionUnit.create({
        data: {
          contractId: contract.id,
          caseId,
          refinementRequestId: data.refinementRequestId || null,
          unitCode: data.unitCode,
          type: data.type,
          quantityPairs: data.quantityPairs,
          stagesDescription: data.stagesDescription,
          status: 'PENDING',
          plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
          plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'PRODUCTION_UNIT_CREATED',
          entityAffected: 'ProductionUnit',
          payloadDiff: JSON.stringify({
            unitId: created.id,
            unitCode: created.unitCode,
            quantityPairs: created.quantityPairs,
            type: created.type,
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Backend',
        },
      });

      return created;
    });

    return NextResponse.json({ unit }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro ao criar unidade de produção.' }, { status: 500 });
  }
}
