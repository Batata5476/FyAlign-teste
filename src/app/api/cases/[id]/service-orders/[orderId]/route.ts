import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { calculateProductionDueAt } from '@/lib/sla/treatment-sla';

const updateServiceOrderActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('VERIFY_DOCS'),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('REPORT_DOCS_PENDING'),
    reason: z.string().min(4, 'Informe o motivo da pendência documental'),
  }),
  z.object({
    action: z.literal('UPDATE_NEMO'),
    nemoStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'INSERTED', 'ERROR']),
    nemoCaseId: z.string().optional().nullable(),
    nemoNotes: z.string().optional().nullable(),
    externalUrl: z.string().url().optional().or(z.literal('')).nullable(),
  }),
  z.object({
    action: z.literal('RECORD_COMMUNICATION'),
    eventType: z.enum([
      'SETUP_SENT',
      'BUDGET_SENT',
      'CLIENT_APPROVAL_RECORDED',
      'SHIPMENT_NOTIFIED',
      'COMMERCIAL_NOTE',
    ]),
    channel: z.enum(['WHATSAPP', 'PORTAL', 'PHONE', 'EMAIL', 'INTERNAL']).default('WHATSAPP'),
    summary: z.string().min(3, 'Informe um resumo da comunicação'),
    details: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal('RELEASE_PRODUCTION'),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('ADVANCE_PRODUCTION_STATUS'),
    status: z.enum(['IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED']),
    notes: z.string().optional(),
  }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; orderId: string } }
) {
  const { id: caseId, orderId } = params;

  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };

  const targetOrder = await prisma.serviceOrder.findFirst({
    where: { id: orderId, caseId },
    include: {
      case: {
        include: { commercialContract: true },
      },
    },
  });

  if (!targetOrder) {
    return NextResponse.json(
      { error: 'Solicitação / Ordem de Serviço não encontrada para este tratamento.' },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const input = updateServiceOrderActionSchema.parse(body);
    const now = new Date();
    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'FyAlign/FaseB';

    // 1. Conferência de Documentação (Felipe / Dr. Adriano)
    if (input.action === 'VERIFY_DOCS') {
      if (!hasPermission(userCtx, 'DOC_VERIFY')) {
        return NextResponse.json(
          { error: 'Permissão DOC_VERIFY necessária para aprovar conferência documental.' },
          { status: 403 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.update({
          where: { id: orderId },
          data: {
            docsVerifiedAt: now,
            docsVerifiedById: sessionUser.userId,
            docsPendingReason: null,
            status:
              targetOrder.status === 'RECEIVED' ||
              targetOrder.status === 'IN_REVIEW' ||
              targetOrder.status === 'PENDING_DOCS'
                ? 'DOCS_VERIFIED'
                : targetOrder.status,
          },
        });

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: 'COMMERCIAL_NOTE',
            channel: 'INTERNAL',
            summary: `Documentação conferida e validada (${order.orderNumber})`,
            details: input.notes || null,
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
            action: 'SERVICE_ORDER_DOCS_VERIFIED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({ orderId, notes: input.notes || null }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // 2. Apontamento de Pendência Documental
    if (input.action === 'REPORT_DOCS_PENDING') {
      if (!hasPermission(userCtx, 'DOC_VERIFY')) {
        return NextResponse.json(
          { error: 'Permissão DOC_VERIFY necessária para apontar pendência documental.' },
          { status: 403 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.update({
          where: { id: orderId },
          data: {
            status: 'PENDING_DOCS',
            docsPendingReason: input.reason,
          },
        });

        await tx.case.update({
          where: { id: caseId },
          data: { status: 'PENDING_DOCS' },
        });

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: 'DOCS_ISSUE_REPORTED',
            channel: 'PORTAL',
            summary: `Pendência na documentação apontada (${order.orderNumber})`,
            details: input.reason,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // 3. Atualização de Marco Nemo / NemoCast (B-INT01 Prioridade 1)
    if (input.action === 'UPDATE_NEMO') {
      if (!hasPermission(userCtx, 'NEMO_MANAGE')) {
        return NextResponse.json(
          { error: 'Permissão NEMO_MANAGE necessária para registrar operação no Nemo.' },
          { status: 403 }
        );
      }

      const cleanNemoId = input.nemoCaseId?.trim() || targetOrder.nemoCaseId || null;

      const updated = await prisma.$transaction(async (tx) => {
        const nextStatus =
          input.nemoStatus === 'INSERTED' &&
          ['RECEIVED', 'IN_REVIEW', 'DOCS_VERIFIED'].includes(targetOrder.status)
            ? 'IN_PLANNING'
            : targetOrder.status;

        const order = await tx.serviceOrder.update({
          where: { id: orderId },
          data: {
            nemoStatus: input.nemoStatus,
            nemoCaseId: cleanNemoId,
            nemoNotes: input.nemoNotes !== undefined ? input.nemoNotes : targetOrder.nemoNotes,
            nemoInsertedAt:
              input.nemoStatus === 'INSERTED' ? now : targetOrder.nemoInsertedAt,
            nemoInsertedById:
              input.nemoStatus === 'INSERTED'
                ? sessionUser.userId
                : targetOrder.nemoInsertedById,
            status: nextStatus,
          },
        });

        if (cleanNemoId) {
          const existingLink = await tx.externalSystemLink.findFirst({
            where: {
              serviceOrderId: orderId,
              provider: 'NEMO',
            },
          });

          const linkData = {
            organizationId: targetOrder.case.clinicId,
            caseId,
            serviceOrderId: orderId,
            entityType: 'SERVICE_ORDER',
            provider: 'NEMO',
            externalId: cleanNemoId,
            externalUrl: input.externalUrl || null,
            syncStatus: input.nemoStatus === 'ERROR' ? 'ERROR' : input.nemoStatus === 'INSERTED' ? 'SYNCED' : 'PENDING',
            metadataJson: JSON.stringify({
              operatorName: sessionUser.fullName,
              nemoStatus: input.nemoStatus,
              notes: input.nemoNotes || null,
            }),
            lastSyncedAt: now,
            createdById: sessionUser.userId,
          };

          if (existingLink) {
            await tx.externalSystemLink.update({
              where: { id: existingLink.id },
              data: linkData,
            });
          } else {
            await tx.externalSystemLink.create({ data: linkData });
          }
        }

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: 'NEMO_UPDATED',
            channel: 'INTERNAL',
            summary: `Nemo CAD atualizado: ${input.nemoStatus}${cleanNemoId ? ` (#${cleanNemoId})` : ''}`,
            details: input.nemoNotes || null,
            isInternalOnly: true,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // 4. Registro de Comunicação Comercial / WhatsApp (Laís / Dr. Paulo)
    if (input.action === 'RECORD_COMMUNICATION') {
      if (!hasPermission(userCtx, 'COMMERCIAL_COMMUNICATE')) {
        return NextResponse.json(
          { error: 'Permissão COMMERCIAL_COMMUNICATE necessária para registrar comunicação comercial.' },
          { status: 403 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const orderPatch: Record<string, any> = {};
        if (input.eventType === 'SETUP_SENT') {
          orderPatch.setupSentAt = targetOrder.setupSentAt || now;
          if (['RECEIVED', 'DOCS_VERIFIED', 'IN_PLANNING', 'SETUP_READY'].includes(targetOrder.status)) {
            orderPatch.status = 'WAITING_APPROVAL';
          }
        }

        const order =
          Object.keys(orderPatch).length > 0
            ? await tx.serviceOrder.update({
                where: { id: orderId },
                data: orderPatch,
              })
            : targetOrder;

        const event = await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: input.eventType,
            channel: input.channel,
            summary: input.summary,
            details: input.details || null,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        return { order, event };
      });

      return NextResponse.json({
        serviceOrder: updated.order,
        operationalEvent: updated.event,
      });
    }

    // 5. Liberação Técnica de Produção (Dr. Adriano — PLANNER_3D / SUPER_ADMIN)
    if (input.action === 'RELEASE_PRODUCTION') {
      if (!hasPermission(userCtx, 'PRODUCTION_RELEASE')) {
        return NextResponse.json(
          { error: 'Permissão PRODUCTION_RELEASE necessária para liberar fabricação.' },
          { status: 403 }
        );
      }

      const contract = targetOrder.case.commercialContract;
      const baseApprovalDate = targetOrder.approvedAt || now;
      const productionDueAt =
        targetOrder.productionDueAt ||
        (targetOrder.type === 'SECOND_BATCH'
          ? null
          : calculateProductionDueAt(baseApprovalDate, {
              days: contract?.productionSlaDays,
              dayType: contract?.productionSlaDayType,
            }));

      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.update({
          where: { id: orderId },
          data: {
            productionReleasedAt: now,
            productionReleasedById: sessionUser.userId,
            approvedAt: targetOrder.approvedAt || now,
            productionDueAt,
            status: 'RELEASED_FOR_PRODUCTION',
          },
        });

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: 'COMMERCIAL_NOTE',
            channel: 'INTERNAL',
            summary: `Produção liberada tecnicamente (${order.orderNumber})`,
            details: input.notes || null,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // 6. Avanço de Etapa Operacional Fabril/Logística (Felipe / Laís)
    if (input.action === 'ADVANCE_PRODUCTION_STATUS') {
      const canAdvance =
        hasPermission(userCtx, 'PRODUCTION_UPDATE') ||
        hasPermission(userCtx, 'SHIPMENT_DISPATCH');

      if (!canAdvance) {
        return NextResponse.json(
          { error: 'Sem permissão fabril/logística para atualizar status da OS.' },
          { status: 403 }
        );
      }

      const isCompleted = input.status === 'SHIPPED' || input.status === 'DELIVERED';
      const updated = await prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: input.status,
          completedAt: isCompleted ? targetOrder.completedAt || now : targetOrder.completedAt,
          notes: input.notes || targetOrder.notes,
        },
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro em PATCH /service-orders/[orderId]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao atualizar solicitação operacional.' },
      { status: 500 }
    );
  }
}
