import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, isFyAlignInternal } from '@/lib/auth/rbac';

const updateStatusSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'CAD_DESIGN',
    'WAITING_DOCTOR_APPROVAL',
    'APPROVED',
    'IN_PRODUCTION',
    'QUALITY_CONTROL',
    'DISPATCHED',
    'DELIVERED',
    'CANCELLED',
  ]),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Apenas equipe do laboratório com permissão operacional/triagem ativa pode atualizar a esteira fabril
  const canUpdatePipeline =
    isFyAlignInternal(sessionUser.role) &&
    (hasPermission(sessionUser, 'PRODUCTION_UPDATE') ||
      hasPermission(sessionUser, 'TRIAGE_CASE') ||
      hasPermission(sessionUser, 'CASE_UPDATE'));

  if (!canUpdatePipeline) {
    return NextResponse.json(
      { error: 'Apenas membros da produção e planejamento FyAlign com permissão ativa podem atualizar a esteira fabril.' },
      { status: 403 }
    );
  }

  const caseId = params.id;
  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { status, notes } = updateStatusSchema.parse(body);

    const oldStatus = clinicalCase.status;

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: { status },
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        action: 'CASE_STATUS_CHANGED',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify({
          from: oldStatus,
          to: status,
          notes: notes || null,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Lab',
      },
    });

    return NextResponse.json({
      message: `Status atualizado de ${oldStatus} para ${status}.`,
      case: updatedCase,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro ao atualizar status' }, { status: 500 });
  }
}
