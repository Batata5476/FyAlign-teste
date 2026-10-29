import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { ClinicalConditionSchema, isCaseClinicallyLocked } from '@/lib/types/clinical';

const db = prisma as any;

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

  const condition = await db.clinicalCondition.findUnique({
    where: { caseId },
  });

  return NextResponse.json({ clinicalCondition: condition });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'CASE_UPDATE',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const existingCase = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!existingCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  if (isCaseClinicallyLocked(existingCase.status)) {
    return NextResponse.json(
      { error: 'Caso bloqueado para alterações após aprovação médica e entrada na esteira de produção (RN-03).' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const validated = ClinicalConditionSchema.parse(body);

    const condition = await db.clinicalCondition.upsert({
      where: { caseId },
      create: {
        caseId,
        upperMidline: validated.upperMidline,
        lowerMidline: validated.lowerMidline,
        canineRight: validated.canineRight,
        canineLeft: validated.canineLeft,
        molarRight: validated.molarRight,
        molarLeft: validated.molarLeft,
      },
      update: {
        upperMidline: validated.upperMidline,
        lowerMidline: validated.lowerMidline,
        canineRight: validated.canineRight,
        canineLeft: validated.canineLeft,
        molarRight: validated.molarRight,
        molarLeft: validated.molarLeft,
      },
    });

    await prisma.auditLog.create({
      data: {
        caseId,
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: auth.user.activeMembershipId,
        action: 'UPDATE_CLINICAL_CONDITION',
        entityAffected: 'ClinicalCondition',
        payloadDiff: JSON.stringify(validated),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
    });

    return NextResponse.json({ clinicalCondition: condition }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Dados inválidos da condição clínica.', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao salvar condição clínica:', error);
    return NextResponse.json(
      { error: 'Erro interno ao salvar a condição clínica.' },
      { status: 500 }
    );
  }
}
