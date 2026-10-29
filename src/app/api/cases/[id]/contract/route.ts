import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasCommercialAuthority } from '@/lib/auth/rbac';
import { CreateContractSchema } from '@/lib/types/contract';
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
  if (sessionUser.organizationType === 'CLINIC' && clinicalCase.clinicId !== sessionUser.organizationId) {
    return NextResponse.json({ error: 'Caso não encontrado ou acesso não autorizado.' }, { status: 404 });
  }

  const contract = await prisma.caseCommercialContract.findUnique({
    where: { caseId },
    include: {
      versions: {
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
  if (sessionUser.organizationType === 'CLINIC' && clinicalCase.clinicId !== sessionUser.organizationId) {
    return NextResponse.json({ error: 'Caso não encontrado ou acesso não autorizado.' }, { status: 404 });
  }

  if (clinicalCase.commercialContract) {
    return NextResponse.json(
      { error: 'Este caso clínico já possui um contrato comercial associado (Invariante 1).' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const data = CreateContractSchema.parse(body);

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractCode = `CTR-${year}-${randomSuffix}`;

    const newContract = await prisma.caseCommercialContract.create({
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
        commercialNotes: data.commercialNotes || null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ contract: newContract }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro ao criar contrato.' }, { status: 500 });
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
    return NextResponse.json({ error: 'Contrato comercial não encontrado para este caso.' }, { status: 404 });
  }

  const currentContract = clinicalCase.commercialContract;

  if (currentContract.status === 'CONFIRMED') {
    return NextResponse.json(
      { message: 'Contrato já confirmado anteriormente.', contract: currentContract },
      { status: 200 }
    );
  }

  if (currentContract.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Contrato cancelado não pode ser confirmado.' }, { status: 400 });
  }

  // Operação Atômica: Confirmação + Version 1 Snapshot + Avaliação do Gatilho de Produção
  const now = new Date();
  const confirmedContract = await prisma.$transaction(async (tx) => {
    // 1. Atualizar Contrato
    const updated = await tx.caseCommercialContract.update({
      where: { id: currentContract.id },
      data: {
        status: 'CONFIRMED',
        confirmedById: sessionUser.userId,
        confirmedAt: now,
      },
    });

    // 2. Criar Snapshot da Versão 1
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
        snapshotJson,
        changeReason: 'Confirmação comercial inicial do contrato.',
        changedById: sessionUser.userId,
      },
    });

    // 3. Gatilho de Produção: Se o Setup Clínico já estiver APROVADO, liberar para IN_PRODUCTION
    const hasApprovedSetup = clinicalCase.setups.length > 0;
    if (hasApprovedSetup && ['APPROVED', 'CAD_DESIGN', 'WAITING_DOCTOR_APPROVAL'].includes(clinicalCase.status)) {
      await tx.case.update({
        where: { id: caseId },
        data: { status: 'IN_PRODUCTION' },
      });
    }

    // 4. Trilha de Auditoria
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
          totalPriceCents: currentContract.totalPriceCents,
          contractedAligners: currentContract.contractedAligners,
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
