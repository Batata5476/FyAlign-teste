import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { QcInspectionSchema } from '@/lib/types/production';
import { z } from 'zod';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; unitId: string } }
) {
  const auth = await authorize(req, { permission: 'PRODUCTION_QC_RELEASE' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const { id: caseId, unitId } = params;

  const unit = await prisma.productionUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit || unit.caseId !== caseId) {
    return NextResponse.json(
      { error: 'Unidade de produção não encontrada para este caso.' },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const checklist = QcInspectionSchema.parse(body);

    const now = new Date();
    const newStatus = checklist.approved ? 'QC_PASSED' : 'QC_REJECTED';

    const updatedUnit = await prisma.$transaction(async (tx) => {
      const updated = await tx.productionUnit.update({
        where: { id: unit.id },
        data: {
          status: newStatus,
          qcApprovedAt: checklist.approved ? now : null,
          qcApprovedById: checklist.approved ? sessionUser.userId : null,
          qcNotes: checklist.qcNotes || null,
        },
      });

      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: checklist.approved ? 'QC_UNIT_PASSED' : 'QC_UNIT_REJECTED',
          entityAffected: 'ProductionUnit',
          payloadDiff: JSON.stringify({
            unitId: unit.id,
            unitCode: unit.unitCode,
            status: newStatus,
            checklist,
            inspectorName: sessionUser.fullName,
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/QC',
        },
      });

      return updated;
    });

    return NextResponse.json({
      message: checklist.approved
        ? `Unidade ${unit.unitCode} aprovada no Controle de Qualidade e liberada para expedição.`
        : `Unidade ${unit.unitCode} reprovada no QC e devolvida para correção.`,
      unit: updatedUnit,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro na inspeção QC.' }, { status: 500 });
  }
}
