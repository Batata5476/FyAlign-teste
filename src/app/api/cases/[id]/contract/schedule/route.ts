import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { UpdateScheduleSchema } from '@/lib/types/contract';
import { z } from 'zod';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'SCHEDULE_UPDATE' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  try {
    const body = await req.json();
    const data = UpdateScheduleSchema.parse(body);

    const unit = await prisma.productionUnit.findUnique({
      where: { id: data.unitId },
    });

    if (!unit || unit.caseId !== caseId) {
      return NextResponse.json(
        { error: 'Unidade de produção não encontrada para este caso.' },
        { status: 404 }
      );
    }

    const oldSchedule = {
      plannedStartDate: unit.plannedStartDate?.toISOString() || null,
      plannedEndDate: unit.plannedEndDate?.toISOString() || null,
    };

    const newPlannedStartDate = data.plannedStartDate !== undefined
      ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
      : unit.plannedStartDate;

    const newPlannedEndDate = data.plannedEndDate !== undefined
      ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
      : unit.plannedEndDate;

    const updatedUnit = await prisma.$transaction(async (tx) => {
      const updated = await tx.productionUnit.update({
        where: { id: unit.id },
        data: {
          plannedStartDate: newPlannedStartDate,
          plannedEndDate: newPlannedEndDate,
        },
      });

      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'SCHEDULE_UPDATED',
          entityAffected: 'ProductionUnit',
          payloadDiff: JSON.stringify({
            unitId: unit.id,
            unitCode: unit.unitCode,
            changeReason: data.changeReason,
            from: oldSchedule,
            to: {
              plannedStartDate: newPlannedStartDate?.toISOString() || null,
              plannedEndDate: newPlannedEndDate?.toISOString() || null,
            },
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Backend',
        },
      });

      return updated;
    });

    return NextResponse.json({
      message: 'Cronograma da unidade de produção atualizado com sucesso.',
      unit: updatedUnit,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro ao atualizar cronograma.' }, { status: 500 });
  }
}
