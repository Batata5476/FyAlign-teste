import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasCommercialAuthority } from '@/lib/auth/rbac';
import { CommercialApproveRefinementSchema } from '@/lib/types/production';
import { calculateProductionDueAt } from '@/lib/sla/treatment-sla';
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
    include: {
      contract: true,
    },
  });

  if (!refinement || refinement.caseId !== caseId) {
    return NextResponse.json(
      { error: 'Solicitação de refinamento não encontrada para este caso.' },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const data = CommercialApproveRefinementSchema.parse(body);

    const now = new Date();
    const newCommercialStatus = data.approved ? 'COMMERCIALLY_APPROVED' : 'COMMERCIAL_REJECTED';

    if (refinement.commercialStatus === newCommercialStatus && refinement.commerciallyApprovedAt) {
      return NextResponse.json({
        message: 'Decisão comercial já registrada anteriormente.',
        refinement,
        idempotentReplay: true,
      });
    }

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

      const linkedOrder = await tx.serviceOrder.findFirst({
        where: {
          caseId,
          refinementRequestId: refinement.id,
        },
      });

      if (linkedOrder) {
        if (data.approved) {
          const canReleaseNow =
            linkedOrder.status === 'WAITING_PAYMENT' && Boolean(linkedOrder.approvedAt);
          const productionDueAt = canReleaseNow
            ? calculateProductionDueAt(now, {
                days: refinement.contract?.productionSlaDays,
                dayType: refinement.contract?.productionSlaDayType,
              })
            : linkedOrder.productionDueAt;

          await tx.serviceOrder.update({
            where: { id: linkedOrder.id },
            data: {
              requiresNewBudget: false,
              productionDueAt,
              status: canReleaseNow ? 'RELEASED_FOR_PRODUCTION' : linkedOrder.status,
              productionReleasedAt: canReleaseNow ? now : linkedOrder.productionReleasedAt,
              productionReleasedById: canReleaseNow
                ? sessionUser.userId
                : linkedOrder.productionReleasedById,
            },
          });
        } else {
          await tx.serviceOrder.update({
            where: { id: linkedOrder.id },
            data: {
              status: 'CANCELLED',
              completedAt: now,
            },
          });
        }
      }

      await tx.operationalEvent.create({
        data: {
          caseId,
          serviceOrderId: linkedOrder?.id || null,
          eventType: 'REFINEMENT_COMMERCIAL_DECISION',
          channel: 'INTERNAL',
          summary: data.approved
            ? `Refinamento #${refinement.sequenceNumber} aprovado comercialmente pelo Financeiro`
            : `Refinamento #${refinement.sequenceNumber} reprovado comercialmente`,
          details: data.commercialNotes || null,
          isInternalOnly: false,
          recordedById: sessionUser.userId,
          occurredAt: now,
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
            approverId: sessionUser.userId,
            approver: sessionUser.fullName,
            decidedAt: now.toISOString(),
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
    return NextResponse.json(
      { error: err.message || 'Erro na decisão comercial.' },
      { status: 500 }
    );
  }
}
