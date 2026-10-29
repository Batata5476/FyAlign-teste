import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasCommercialAuthority } from '@/lib/auth/rbac';
import { CommercialApproveRefinementSchema } from '@/lib/types/production';
import { z } from 'zod';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; refinementId: string } }
) {
  const auth = await authorize(req, { permission: 'REFINEMENT_COMMERCIAL_APPROVE' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const { id: caseId, refinementId } = params;

  if (!hasCommercialAuthority(sessionUser)) {
    return NextResponse.json(
      { error: 'Apenas membros com autoridade comercial na FyAlign podem aprovar custos de refinamento.' },
      { status: 403 }
    );
  }

  const refinement = await prisma.refinementRequest.findUnique({
    where: { id: refinementId },
  });

  if (!refinement || refinement.caseId !== caseId) {
    return NextResponse.json({ error: 'Solicitação de refinamento não encontrada para este caso.' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = CommercialApproveRefinementSchema.parse(body);

    const now = new Date();
    const newCommercialStatus = data.approved ? 'COMMERCIALLY_APPROVED' : 'COMMERCIAL_REJECTED';

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.refinementRequest.update({
        where: { id: refinement.id },
        data: {
          commercialStatus: newCommercialStatus,
          isCoveredByContract: data.isCoveredByContract,
          extraAmountChargedCents: data.extraAmountChargedCents,
          commerciallyApprovedById: sessionUser.userId,
          commerciallyApprovedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'REFINEMENT_COMMERCIAL_DECISION',
          entityAffected: 'RefinementRequest',
          payloadDiff: JSON.stringify({
            refinementId: refinement.id,
            decision: newCommercialStatus,
            isCoveredByContract: data.isCoveredByContract,
            extraAmountChargedCents: data.extraAmountChargedCents,
            approver: sessionUser.fullName,
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Backend',
        },
      });

      return res;
    });

    return NextResponse.json({
      message: data.approved
        ? 'Decisão comercial aprovada com sucesso. Produção adicional liberada.'
        : 'Refinamento rejeitado comercialmente.',
      refinement: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro na decisão comercial.' }, { status: 500 });
  }
}
