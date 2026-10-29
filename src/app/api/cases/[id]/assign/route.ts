import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { isFyAlignInternal } from '@/lib/auth/rbac';

const assignSchema = z.object({
  plannerId: z.string().uuid({ message: 'ID do planejador deve ser um UUID válido.' }),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, {
    permission: 'CASE_UPDATE',
    resource: { type: 'CASE', id: params.id },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  if (!isFyAlignInternal(auth.user.role)) {
    return NextResponse.json(
      { error: 'Apenas a coordenação do laboratório pode atribuir planejadores (F5.12).' },
      { status: 403 }
    );
  }

  const caseId = params.id;

  try {
    const body = await req.json();
    const { plannerId } = assignSchema.parse(body);

    const targetPlanner: any = await (prisma.user as any).findUnique({
      where: { id: plannerId },
      include: {
        memberships: {
          where: {
            role: { in: ['PLANNER_3D', 'SUPER_ADMIN'] },
            status: 'ACTIVE',
          },
        },
      },
    });

    const isPlannerValid =
      (targetPlanner?.memberships && targetPlanner.memberships.length > 0) ||
      (targetPlanner?.role && ['PLANNER_3D', 'SUPER_ADMIN'].includes(targetPlanner.role));

    if (!targetPlanner || !isPlannerValid) {
      return NextResponse.json(
        { error: 'O usuário selecionado não possui prerrogativa de Planejador 3D.' },
        { status: 400 }
      );
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: { assignedPlannerId: plannerId },
      include: {
        assignedPlanner: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        caseId,
        userId: auth.user.userId,
        action: 'PLANNER_ASSIGNED',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify({
          assignedPlannerId: plannerId,
          assignedPlannerName: targetPlanner.fullName,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Lab',
      },
    });

    return NextResponse.json({
      message: `Caso atribuído com sucesso a ${targetPlanner.fullName}.`,
      case: updatedCase,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro ao atribuir planejador' }, { status: 500 });
  }
}
