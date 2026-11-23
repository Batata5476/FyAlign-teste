import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import {
  calculateProductionDueAt,
  calculateSecondBatchPrepDueAt,
  estimateBatchEndDate,
} from '@/lib/sla/treatment-sla';
import {
  hasClinicallyApprovedInitialSetup,
  isContractActiveAndConfirmed,
} from '@/lib/domain/treatment-lifecycle';

const updateServiceOrderActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('VERIFY_DOCS'),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('SCHEDULE_SECOND_BATCH'),
    scheduledPrepAt: z.string().optional(),
    previousBatchEndDate: z.string().optional(),
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
      refinementRequest: true,
      case: {
        include: {
          commercialContract: true,
          setups: { orderBy: { versionNumber: 'desc' } },
          productionUnits: true,
          shipments: { orderBy: { createdAt: 'desc' } },
        },
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

    // ========================================================================
    // 1. Conferência e Programação Interna da Segunda Leva (RECEIVED -> SCHEDULED)
    // ========================================================================
    if (
      input.action === 'SCHEDULE_SECOND_BATCH' ||
      (input.action === 'VERIFY_DOCS' && targetOrder.type === 'SECOND_BATCH')
    ) {
      const canSchedule =
        sessionUser.organizationType === 'FYALIGN' &&
        (hasPermission(userCtx, 'DOC_VERIFY') || hasPermission(userCtx, 'SCHEDULE_UPDATE'));

      if (!canSchedule) {
        return NextResponse.json(
          {
            error:
              'Apenas a equipe interna do laboratório (DOC_VERIFY ou SCHEDULE_UPDATE) pode conferir e programar a Segunda Leva.',
            code: 'FORBIDDEN_SECOND_BATCH_CONFERENCE',
          },
          { status: 403 }
        );
      }

      if (targetOrder.type !== 'SECOND_BATCH') {
        return NextResponse.json(
          { error: 'Esta ação é exclusiva para solicitações do tipo SECOND_BATCH.' },
          { status: 400 }
        );
      }

      if (targetOrder.status === 'SCHEDULED' && targetOrder.docsVerifiedAt) {
        return NextResponse.json(
          { serviceOrder: targetOrder, idempotentReplay: true },
          { status: 200 }
        );
      }

      if (targetOrder.status !== 'RECEIVED' && targetOrder.status !== 'PENDING_DOCS') {
        return NextResponse.json(
          {
            error: `Transição inválida: Segunda Leva em estado ${targetOrder.status} não pode retornar para SCHEDULED.`,
            code: 'INVALID_SECOND_BATCH_STATE',
          },
          { status: 409 }
        );
      }

      const contract = targetOrder.case.commercialContract;
      if (!isContractActiveAndConfirmed(contract)) {
        return NextResponse.json(
          {
            error:
              'Conferência bloqueada: o Contrato Comercial deste tratamento não está confirmado.',
            code: 'CONTRACT_NOT_CONFIRMED',
          },
          { status: 409 }
        );
      }

      let computedScheduledPrepAt: Date;
      if (input.action === 'SCHEDULE_SECOND_BATCH' && input.scheduledPrepAt) {
        computedScheduledPrepAt = new Date(input.scheduledPrepAt);
      } else {
        const prevBatchPairs = Math.max(1, (targetOrder.alignerRangeStart || 13) - 1);
        const startRef =
          (input.action === 'SCHEDULE_SECOND_BATCH' && input.previousBatchEndDate
            ? null
            : targetOrder.case.shipments?.[0]?.deliveredAt ||
              targetOrder.case.shipments?.[0]?.shippedAt ||
              targetOrder.case.approvedAt ||
              targetOrder.case.createdAt);
        const prevEnd =
          input.action === 'SCHEDULE_SECOND_BATCH' && input.previousBatchEndDate
            ? new Date(input.previousBatchEndDate)
            : estimateBatchEndDate(new Date(startRef!), prevBatchPairs);
        computedScheduledPrepAt = calculateSecondBatchPrepDueAt(prevEnd, 30);
      }

      const confNotes = input.notes || null;

      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.update({
          where: { id: orderId },
          data: {
            status: 'SCHEDULED',
            docsVerifiedAt: now,
            docsVerifiedById: sessionUser.userId,
            docsPendingReason: null,
            scheduledPrepAt: computedScheduledPrepAt,
            notes: confNotes || targetOrder.notes,
          },
        });

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: 'SECOND_BATCH_SCHEDULED',
            channel: 'INTERNAL',
            summary: `Segunda Leva conferida e programada (${order.orderNumber}) — meta T-30d: ${computedScheduledPrepAt.toLocaleDateString('pt-BR')}`,
            details: confNotes,
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
            action: 'SERVICE_ORDER_SECOND_BATCH_SCHEDULED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              orderId,
              orderNumber: order.orderNumber,
              previousStatus: targetOrder.status,
              newStatus: 'SCHEDULED',
              requestedById: targetOrder.requestedById,
              receivedAt: targetOrder.receivedAt?.toISOString() || null,
              docsVerifiedById: sessionUser.userId,
              docsVerifiedAt: now.toISOString(),
              scheduledPrepAt: computedScheduledPrepAt.toISOString(),
              notes: confNotes,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // ========================================================================
    // 2. Conferência de Documentação Clínica (Felipe / Dr. Adriano — INITIAL / REFINEMENT)
    // ========================================================================
    if (input.action === 'VERIFY_DOCS') {
      if (sessionUser.organizationType !== 'FYALIGN' || !hasPermission(userCtx, 'DOC_VERIFY')) {
        return NextResponse.json(
          { error: 'Permissão DOC_VERIFY necessária para aprovar conferência documental.' },
          { status: 403 }
        );
      }

      if (targetOrder.status === 'DOCS_VERIFIED' && targetOrder.docsVerifiedAt) {
        return NextResponse.json(
          { serviceOrder: targetOrder, idempotentReplay: true },
          { status: 200 }
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
            eventType: 'DOCS_VERIFIED',
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
            payloadDiff: JSON.stringify({
              orderId,
              docsVerifiedById: sessionUser.userId,
              docsVerifiedAt: now.toISOString(),
              notes: input.notes || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // ========================================================================
    // 3. Apontamento de Pendência Documental
    // ========================================================================
    if (input.action === 'REPORT_DOCS_PENDING') {
      if (sessionUser.organizationType !== 'FYALIGN' || !hasPermission(userCtx, 'DOC_VERIFY')) {
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

        // Preserva o status de tratamentos já aprovados/em produção caso a pendência ocorra em ciclo posterior
        if (
          targetOrder.type === 'INITIAL' &&
          !['APPROVED', 'IN_PRODUCTION', 'COMPLETED'].includes(targetOrder.case.status)
        ) {
          await tx.case.update({
            where: { id: caseId },
            data: { status: 'PENDING_DOCS' },
          });
        }

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

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_DOCS_PENDING_REPORTED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              orderId,
              reason: input.reason,
              reportedById: sessionUser.userId,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // ========================================================================
    // 4. Atualização de Marco Nemo / NemoCast (B-INT01 Prioridade 1)
    // ========================================================================
    if (input.action === 'UPDATE_NEMO') {
      if (sessionUser.organizationType !== 'FYALIGN' || !hasPermission(userCtx, 'NEMO_MANAGE')) {
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
            syncStatus:
              input.nemoStatus === 'ERROR'
                ? 'ERROR'
                : input.nemoStatus === 'INSERTED'
                ? 'SYNCED'
                : 'PENDING',
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

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_NEMO_UPDATED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              orderId,
              nemoStatus: input.nemoStatus,
              nemoCaseId: cleanNemoId,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    // ========================================================================
    // 5. Registro de Comunicação Comercial / WhatsApp (Laís / SUPER_ADMIN)
    // ========================================================================
    if (input.action === 'RECORD_COMMUNICATION') {
      if (!hasPermission(userCtx, 'COMMERCIAL_COMMUNICATE')) {
        return NextResponse.json(
          {
            error:
              'Permissão COMMERCIAL_COMMUNICATE necessária para registrar comunicação comercial.',
          },
          { status: 403 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const orderPatch: Record<string, any> = {};
        if (input.eventType === 'SETUP_SENT') {
          orderPatch.setupSentAt = targetOrder.setupSentAt || now;
          if (
            ['RECEIVED', 'DOCS_VERIFIED', 'IN_PLANNING', 'SETUP_READY'].includes(
              targetOrder.status
            )
          ) {
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

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_COMMUNICATION_RECORDED',
            entityAffected: 'OperationalEvent',
            payloadDiff: JSON.stringify({
              orderId,
              eventId: event.id,
              eventType: input.eventType,
              channel: input.channel,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return { order, event };
      });

      return NextResponse.json({
        serviceOrder: updated.order,
        operationalEvent: updated.event,
      });
    }

    // ========================================================================
    // 6. Liberação Formal de Produção (Felipe / Dr. Adriano / SUPER_ADMIN)
    // ========================================================================
    if (input.action === 'RELEASE_PRODUCTION') {
      if (
        sessionUser.organizationType !== 'FYALIGN' ||
        !hasPermission(userCtx, 'PRODUCTION_RELEASE')
      ) {
        return NextResponse.json(
          { error: 'Permissão interna PRODUCTION_RELEASE necessária para liberar fabricação.' },
          { status: 403 }
        );
      }

      if (targetOrder.status === 'RELEASED_FOR_PRODUCTION' && targetOrder.productionReleasedAt) {
        return NextResponse.json(
          { serviceOrder: targetOrder, idempotentReplay: true },
          { status: 200 }
        );
      }

      const contract = targetOrder.case.commercialContract;
      if (!isContractActiveAndConfirmed(contract)) {
        return NextResponse.json(
          {
            error:
              'Liberação bloqueada: é obrigatório possuir Contrato Comercial confirmado antes de liberar para produção.',
            code: 'CONTRACT_NOT_CONFIRMED',
          },
          { status: 409 }
        );
      }

      // Validações específicas por tipo de OS
      if (targetOrder.type === 'SECOND_BATCH') {
        if (targetOrder.status !== 'SCHEDULED' || !targetOrder.docsVerifiedAt) {
          return NextResponse.json(
            {
              error:
                'Liberação bloqueada: a Segunda Leva precisa passar primeiro pela conferência e programação interna (SCHEDULED) antes de entrar em produção.',
              code: 'SECOND_BATCH_NOT_CONFERRED',
            },
            { status: 409 }
          );
        }
      } else if (targetOrder.type === 'INITIAL') {
        if (!hasClinicallyApprovedInitialSetup(targetOrder.case.setups)) {
          return NextResponse.json(
            {
              error:
                'Liberação bloqueada: o Setup clínico inicial ainda não foi aprovado pelo ortodontista.',
              code: 'SETUP_NOT_APPROVED',
            },
            { status: 409 }
          );
        }
      } else if (targetOrder.type === 'REFINEMENT') {
        const refCommStatus = targetOrder.refinementRequest?.commercialStatus;
        if (
          targetOrder.requiresNewBudget &&
          refCommStatus !== 'APPROVED' &&
          refCommStatus !== 'COMMERCIALLY_APPROVED'
        ) {
          return NextResponse.json(
            {
              error:
                'Liberação bloqueada: este refinamento extra-franquia aguarda aprovação comercial do Financeiro.',
              code: 'REFINEMENT_AWAITING_COMMERCIAL_APPROVAL',
            },
            { status: 409 }
          );
        }
        if (!targetOrder.approvedAt) {
          return NextResponse.json(
            {
              error:
                'Liberação bloqueada: o novo Setup do refinamento ainda não foi aprovado pelo ortodontista.',
              code: 'REFINEMENT_SETUP_NOT_APPROVED',
            },
            { status: 409 }
          );
        }
      }

      const baseApprovalDate = targetOrder.approvedAt || now;
      const productionDueAt =
        targetOrder.productionDueAt ||
        calculateProductionDueAt(baseApprovalDate, {
          days: contract!.productionSlaDays,
          dayType: contract!.productionSlaDayType,
        });

      const updated = await prisma.$transaction(async (tx) => {
        let createdUnit = null;

        if (targetOrder.type === 'SECOND_BATCH') {
          const rangeStart = targetOrder.alignerRangeStart || 1;
          const rangeEnd = targetOrder.alignerRangeEnd || rangeStart;
          const quantityPairs = Math.max(1, rangeEnd - rangeStart + 1);
          const stageDesc = `Segunda Leva: Estágios ${rangeStart} a ${rangeEnd}`;

          const currentUnits = await tx.productionUnit.findMany({
            where: { caseId },
          });

          const existingMatchingUnit = currentUnits.find(
            (u) => u.stagesDescription === stageDesc && u.status !== 'CANCELLED'
          );

          if (!existingMatchingUnit) {
            const committedBasePairs = currentUnits
              .filter(
                (u) =>
                  !u.refinementRequestId &&
                  u.status !== 'CANCELLED' &&
                  u.status !== 'SCRAPPED'
              )
              .reduce((sum, u) => sum + u.quantityPairs, 0);

            if (committedBasePairs + quantityPairs > contract!.contractedAligners) {
              const balErr: any = new Error(
                `Saldo contratual excedido na liberação da Segunda Leva (${committedBasePairs + quantityPairs}/${contract!.contractedAligners} pares).`
              );
              balErr.httpStatus = 409;
              balErr.code = 'SECOND_BATCH_EXCEEDS_CONTRACT';
              throw balErr;
            }

            const unitSeq = currentUnits.length + 1;
            createdUnit = await tx.productionUnit.create({
              data: {
                caseId,
                contractId: contract!.id,
                unitCode: `LOTE-${String(unitSeq).padStart(2, '0')}`,
                type: 'BATCH',
                quantityPairs,
                stagesDescription: stageDesc,
                status: 'IN_PRODUCTION',
                plannedStartDate: now,
                plannedEndDate: productionDueAt,
              },
            });
          } else {
            createdUnit = existingMatchingUnit;
          }
        }

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

        if (['APPROVED', 'COMPLETED'].includes(targetOrder.case.status)) {
          await tx.case.update({
            where: { id: caseId },
            data: { status: 'IN_PRODUCTION' },
          });
        }

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: orderId,
            eventType: 'PRODUCTION_RELEASED',
            channel: 'INTERNAL',
            summary: `Produção liberada formalmente (${order.orderNumber})${
              createdUnit ? ` — ${createdUnit.unitCode}` : ''
            }`,
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
            action: 'SERVICE_ORDER_PRODUCTION_RELEASED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              orderId,
              orderNumber: order.orderNumber,
              type: order.type,
              requestedById: targetOrder.requestedById,
              receivedAt: targetOrder.receivedAt?.toISOString() || null,
              docsVerifiedById: targetOrder.docsVerifiedById,
              docsVerifiedAt: targetOrder.docsVerifiedAt?.toISOString() || null,
              productionReleasedById: sessionUser.userId,
              productionReleasedAt: now.toISOString(),
              productionDueAt: productionDueAt?.toISOString() || null,
              productionUnitId: createdUnit?.id || null,
              notes: input.notes || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return { order, createdUnit };
      });

      return NextResponse.json({
        serviceOrder: updated.order,
        productionUnit: updated.createdUnit,
      });
    }

    // ========================================================================
    // 7. Avanço de Etapa Operacional Fabril/Logística (Felipe / Laís)
    // ========================================================================
    if (input.action === 'ADVANCE_PRODUCTION_STATUS') {
      const canAdvance =
        sessionUser.organizationType === 'FYALIGN' &&
        (hasPermission(userCtx, 'PRODUCTION_UPDATE') ||
          hasPermission(userCtx, 'SHIPMENT_DISPATCH'));

      if (!canAdvance) {
        return NextResponse.json(
          { error: 'Sem permissão fabril/logística para atualizar status da OS.' },
          { status: 403 }
        );
      }

      const isCompleted = input.status === 'SHIPPED' || input.status === 'DELIVERED';
      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.update({
          where: { id: orderId },
          data: {
            status: input.status,
            completedAt: isCompleted ? targetOrder.completedAt || now : targetOrder.completedAt,
            notes: input.notes || targetOrder.notes,
          },
        });

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_STATUS_ADVANCED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              orderId,
              previousStatus: targetOrder.status,
              newStatus: input.status,
              updatedById: sessionUser.userId,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json({ serviceOrder: updated });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 });
    }
    if (err?.httpStatus) {
      return NextResponse.json(
        { error: err.message, code: err.code || 'CONFLICT' },
        { status: err.httpStatus }
      );
    }
    console.error('Erro em PATCH /service-orders/[orderId]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao atualizar solicitação operacional.' },
      { status: 500 }
    );
  }
}
