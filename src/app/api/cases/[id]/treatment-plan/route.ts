import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { TreatmentPlanSchema, isCaseClinicallyLocked } from '@/lib/types/clinical';

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

  const plan = await db.treatmentPlan.findUnique({
    where: { caseId },
  });

  return NextResponse.json({ treatmentPlan: plan });
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
    const validated = TreatmentPlanSchema.parse(body);

    const plan = await db.treatmentPlan.upsert({
      where: { caseId },
      create: {
        caseId,
        upperMidline: validated.upperMidline,
        lowerMidline: validated.lowerMidline,
        overjet: validated.overjet,
        overbite: validated.overbite,
        archForm: validated.archForm,
        expansion: validated.expansion,
        canineRelationship: validated.canineRelationship,
        molarRelationship: validated.molarRelationship,
        ipr: validated.ipr,
        attachment: validated.attachment,
        intermaxillaryElastic: validated.intermaxillaryElastic,
        classIICorrection: validated.classIICorrection,
        classIIICorrection: validated.classIIICorrection,
        smartAttachments: validated.smartAttachments || null,
        diastemas: validated.diastemas,
        additionalInstructions: validated.additionalInstructions || null,
      },
      update: {
        upperMidline: validated.upperMidline,
        lowerMidline: validated.lowerMidline,
        overjet: validated.overjet,
        overbite: validated.overbite,
        archForm: validated.archForm,
        expansion: validated.expansion,
        canineRelationship: validated.canineRelationship,
        molarRelationship: validated.molarRelationship,
        ipr: validated.ipr,
        attachment: validated.attachment,
        intermaxillaryElastic: validated.intermaxillaryElastic,
        classIICorrection: validated.classIICorrection,
        classIIICorrection: validated.classIIICorrection,
        smartAttachments: validated.smartAttachments || null,
        diastemas: validated.diastemas,
        additionalInstructions: validated.additionalInstructions || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        caseId,
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: auth.user.activeMembershipId,
        action: 'UPDATE_TREATMENT_PLAN',
        entityAffected: 'TreatmentPlan',
        payloadDiff: JSON.stringify(validated),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
    });

    return NextResponse.json({ treatmentPlan: plan }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao salvar plano de tratamento:', error);
    return NextResponse.json(
      { error: 'Erro interno ao salvar plano de tratamento.' },
      { status: 500 }
    );
  }
}
