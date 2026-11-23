import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import {
  buildServiceOrderNumber,
  calculateSetupDueAt,
  evaluateSlaStatus,
} from '@/lib/sla/treatment-sla';
import {
  extractIdempotencyKey,
  findIdempotentAuditReplay,
  validateAdditionalOrderPrerequisites,
} from '@/lib/domain/treatment-lifecycle';

const createServiceOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INITIAL'),
    title: z.string().min(3).optional(),
    alignerRangeStart: z.number().int().positive().optional(),
    alignerRangeEnd: z.number().int().positive().optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }),
  z.object({
    type: z.literal('SECOND_BATCH'),
    title: z.string().min(3).optional(),
    alignerRangeStart: z.number().int().positive(),
    alignerRangeEnd: z.number().int().positive(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }),
  z.object({
    type: z.literal('REFINEMENT'),
    clinicalReason: z
      .string()
      .min(5, 'Descreva o motivo clínico do refinamento (mín. 5 caracteres)'),
    extraAlignersCount: z.number().int().min(0).default(0),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }),
]);

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

  const { user: sessionUser } = auth;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };
  const isClinicViewer = sessionUser.organizationType === 'CLINIC';
  const canSeeNemoDetails =
    !isClinicViewer &&
    (hasPermission(userCtx, 'NEMO_MANAGE') ||
      hasPermission(userCtx, 'SETUP_CREATE') ||
      hasPermission(userCtx, 'PRODUCTION_READ'));
  const canReadContract = hasPermission(userCtx, 'CONTRACT_READ');

  const orders = await prisma.serviceOrder.findMany({
    where: { caseId },
    include: {
      requestedBy: { select: { id: true, fullName: true } },
      docsVerifiedBy: { select: { id: true, fullName: true } },
      nemoInsertedBy: { select: { id: true, fullName: true } },
      productionReleasedBy: { select: { id: true, fullName: true } },
      refinementRequest: true,
      externalLinks: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const now = new Date();
  const enriched = orders.map((order) => ({
    ...order,
    requiresNewBudget: canReadContract ? order.requiresNewBudget : false,
    nemoCaseId: canSeeNemoDetails ? order.nemoCaseId : null,
    nemoNotes: canSeeNemoDetails ? order.nemoNotes : null,
    nemoInsertedBy: canSeeNemoDetails ? order.nemoInsertedBy : null,
    nemoInsertedById: canSeeNemoDetails ? order.nemoInsertedById : null,
    externalLinks: (order.externalLinks || []).filter((l) => {
      if (l.provider === 'NEMO' && !canSeeNemoDetails) return false;
      if (l.provider === 'ERP_FINANCIAL' && !canReadContract) return false;
      return true;
    }),
    refinementRequest: order.refinementRequest
      ? {
          id: order.refinementRequest.id,
          sequenceNumber: order.refinementRequest.sequenceNumber,
          clinicalReason: order.refinementRequest.clinicalReason,
          clinicalStatus: order.refinementRequest.clinicalStatus,
          extraAlignersCount: order.refinementRequest.extraAlignersCount,
          ...(canReadContract
            ? {
                contractVersionUsed: order.refinementRequest.contractVersionUsed,
                isCoveredByContract: order.refinementRequest.isCoveredByContract,
                extraAmountChargedCents: order.refinementRequest.extraAmountChargedCents,
                commercialStatus: order.refinementRequest.commercialStatus,
              }
            : {}),
        }
      : null,
    setupSla: evaluateSlaStatus(order.setupDueAt, order.setupSentAt, now),
    productionSla: evaluateSlaStatus(order.productionDueAt, order.completedAt, now),
    prepScheduleSla: evaluateSlaStatus(
      order.scheduledPrepAt,
      order.productionReleasedAt || order.completedAt,
      now
    ),
  }));

  return NextResponse.json({ serviceOrders: enriched });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  // Autorização base no Caso/Tratamento (com proteção anti-IDOR Cross-Tenant)
  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };

  try {
    const rawBody = await req.json();
    const input = createServiceOrderSchema.parse(rawBody);
    const idempotencyKey = extractIdempotencyKey(req, rawBody);

    const treatment = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        setups: { orderBy: { versionNumber: 'desc' } },
        commercialContract: true,
        refinementRequests: { orderBy: { sequenceNumber: 'asc' } },
        productionUnits: true,
        serviceOrders: { orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!treatment) {
      return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
    }

    const now = new Date();
    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'FyAlign/FaseB';

    // ========================================================================
    // 1. SEGUNDA LEVA (Exclusivo DOCTOR CRO VERIFIED -> nasce SEMPRE como RECEIVED)
    // ========================================================================
    if (input.type === 'SECOND_BATCH') {
      if (sessionUser.role !== 'DOCTOR') {
        return NextResponse.json(
          {
            error:
              'Apenas o Cirurgião-Dentista responsável (DOCTOR) pode solicitar formalmente a Segunda Leva.',
            code: 'FORBIDDEN_SECOND_BATCH_ROLE',
          },
          { status: 403 }
        );
      }

      if (sessionUser.croStatus !== 'VERIFIED') {
        return NextResponse.json(
          {
            error:
              'Solicitação de Segunda Leva bloqueada: registro no CRO pendente de verificação ou inválido (RN-02).',
            code: 'CRO_NOT_VERIFIED',
          },
          { status: 403 }
        );
      }

      // Replay idempotente caso Idempotency-Key já tenha sido processada
      const replay = await findIdempotentAuditReplay(prisma, {
        caseId,
        userId: sessionUser.userId,
        action: 'SERVICE_ORDER_SECOND_BATCH_CREATED',
        idempotencyKey,
      });
      if (replay?.serviceOrderId) {
        const existingOrder = await prisma.serviceOrder.findUnique({
          where: { id: replay.serviceOrderId },
        });
        if (existingOrder) {
          return NextResponse.json(
            {
              message: 'Solicitação de Segunda Leva recuperada de forma idempotente.',
              serviceOrder: existingOrder,
              productionUnit: null,
              idempotentReplay: true,
            },
            { status: 200 }
          );
        }
      }

      // Bloqueio categórico dos 4 pré-requisitos (Setup aprovado + Contrato confirmado + vínculo + saldo)
      const prereq = validateAdditionalOrderPrerequisites(treatment, {
        orderType: 'SECOND_BATCH',
        alignerRangeStart: input.alignerRangeStart,
        alignerRangeEnd: input.alignerRangeEnd,
      });
      if (!prereq.ok) {
        return NextResponse.json(
          { error: prereq.error, code: prereq.code },
          { status: prereq.status || 409 }
        );
      }

      const createdOrder = await prisma.$transaction(async (tx) => {
        const existingOrders = await tx.serviceOrder.findMany({
          where: { caseId },
          orderBy: { sequenceNumber: 'asc' },
        });

        const overlappingSecondBatch = existingOrders.find(
          (so) =>
            so.type === 'SECOND_BATCH' &&
            so.status !== 'CANCELLED' &&
            (so.alignerRangeStart === null ||
              so.alignerRangeEnd === null ||
              (input.alignerRangeStart <= so.alignerRangeEnd &&
                input.alignerRangeEnd >= so.alignerRangeStart))
        );

        if (overlappingSecondBatch) {
          const dupErr: any = new Error(
            `Já existe uma solicitação ativa de Segunda Leva (${overlappingSecondBatch.orderNumber}) para esta faixa de alinhadores.`
          );
          dupErr.httpStatus = 409;
          dupErr.code = 'DUPLICATE_SECOND_BATCH_ORDER';
          throw dupErr;
        }

        const nextSequence = existingOrders.length + 1;

        const order = await tx.serviceOrder.create({
          data: {
            caseId,
            orderNumber: buildServiceOrderNumber(nextSequence, now),
            sequenceNumber: nextSequence,
            type: 'SECOND_BATCH',
            status: 'RECEIVED', // Jamais nasce SCHEDULED ou RELEASED_FOR_PRODUCTION!
            title:
              input.title ||
              `Segunda Leva — Alinhadores ${input.alignerRangeStart}–${input.alignerRangeEnd}`,
            alignerRangeStart: input.alignerRangeStart,
            alignerRangeEnd: input.alignerRangeEnd,
            requiresNewBudget: false,
            nemoStatus: 'NOT_REQUIRED',
            receivedAt: now,
            scheduledPrepAt: null,
            docsVerifiedAt: null,
            docsVerifiedById: null,
            productionReleasedAt: null,
            productionReleasedById: null,
            requestedById: sessionUser.userId,
            notes: input.notes || null,
          },
        });

        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: order.id,
            eventType: 'SECOND_BATCH_TRIGGERED',
            channel: 'PORTAL',
            summary: `Segunda Leva (${input.alignerRangeStart}–${input.alignerRangeEnd}) solicitada pelo ortodontista — aguardando conferência interna`,
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
            action: 'SERVICE_ORDER_SECOND_BATCH_CREATED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              idempotencyKey,
              serviceOrderId: order.id,
              orderNumber: order.orderNumber,
              status: 'RECEIVED',
              alignerRange: `${input.alignerRangeStart}-${input.alignerRangeEnd}`,
              requestedById: sessionUser.userId,
              requestedByCro: sessionUser.professionalIdCro || null,
              receivedAt: now.toISOString(),
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return order;
      });

      return NextResponse.json(
        {
          message:
            'Solicitação de Segunda Leva recebida com sucesso. Aguardando conferência interna do laboratório.',
          serviceOrder: createdOrder,
          productionUnit: null,
        },
        { status: 201 }
      );
    }

    // ========================================================================
    // 2. REFINAMENTO (Exige Setup inicial aprovado + Contrato confirmado)
    // ========================================================================
    if (input.type === 'REFINEMENT') {
      if (!hasPermission(userCtx, 'REFINEMENT_REQUEST')) {
        return NextResponse.json(
          { error: 'Sem permissão REFINEMENT_REQUEST para solicitar refinamento.' },
          { status: 403 }
        );
      }

      if (sessionUser.role === 'DOCTOR' && sessionUser.croStatus !== 'VERIFIED') {
        return NextResponse.json(
          {
            error:
              'Apenas Cirurgiões-Dentistas com CRO verificado podem solicitar refinamento (RN-02).',
            code: 'CRO_NOT_VERIFIED',
          },
          { status: 403 }
        );
      }

      // Replay idempotente
      const replay = await findIdempotentAuditReplay(prisma, {
        caseId,
        userId: sessionUser.userId,
        action: 'SERVICE_ORDER_REFINEMENT_CREATED',
        idempotencyKey,
      });
      if (replay?.serviceOrderId) {
        const existingOrder = await prisma.serviceOrder.findUnique({
          where: { id: replay.serviceOrderId },
        });
        const existingRef = replay.refinementId
          ? await prisma.refinementRequest.findUnique({ where: { id: replay.refinementId } })
          : null;
        if (existingOrder) {
          return NextResponse.json(
            {
              message: 'Solicitação de Refinamento recuperada de forma idempotente.',
              serviceOrder: existingOrder,
              refinement: existingRef,
              idempotentReplay: true,
            },
            { status: 200 }
          );
        }
      }

      // Bloqueio categórico dos 4 pré-requisitos
      const prereq = validateAdditionalOrderPrerequisites(treatment, {
        orderType: 'REFINEMENT',
      });
      if (!prereq.ok) {
        return NextResponse.json(
          { error: prereq.error, code: prereq.code },
          { status: prereq.status || 409 }
        );
      }

      const contract = prereq.contract!;
      const normalizedReason = input.clinicalReason.trim().toLowerCase();

      const created = await prisma.$transaction(async (tx) => {
        const existingRefs = await tx.refinementRequest.findMany({
          where: { caseId },
          orderBy: { sequenceNumber: 'asc' },
        });
        const existingOrders = await tx.serviceOrder.findMany({
          where: { caseId },
          orderBy: { sequenceNumber: 'asc' },
        });

        const duplicateOpen = existingOrders.find((so) => {
          if (so.type !== 'REFINEMENT' || so.status === 'CANCELLED' || so.status === 'DELIVERED') {
            return false;
          }
          const linkedRef = existingRefs.find((r) => r.id === so.refinementRequestId);
          return (
            linkedRef &&
            linkedRef.clinicalReason.trim().toLowerCase() === normalizedReason &&
            linkedRef.extraAlignersCount === input.extraAlignersCount
          );
        });

        if (duplicateOpen) {
          const dupErr: any = new Error(
            `Solicitação de refinamento duplicada detectada (${duplicateOpen.orderNumber}).`
          );
          dupErr.httpStatus = 409;
          dupErr.code = 'DUPLICATE_REFINEMENT_REQUEST';
          throw dupErr;
        }

        const refSequence = existingRefs.length + 1;
        const nextSequence = existingOrders.length + 1;
        const coveredUsedCount = existingRefs.filter((r) => r.isCoveredByContract).length;

        // Cobertura avaliada e CONGELADA sobre a versão contratual vigente no momento da abertura
        const isCoveredByContract = coveredUsedCount < contract.includedRefinements;
        const extraPricePerPair = contract.extraAlignerPriceCents ?? 0;
        const extraAmountChargedCents = isCoveredByContract
          ? 0
          : input.extraAlignersCount * extraPricePerPair;
        const requiresNewBudget = !isCoveredByContract && extraAmountChargedCents > 0;

        const refinementRecord = await tx.refinementRequest.create({
          data: {
            caseId,
            contractId: contract.id,
            contractVersionUsed: contract.versionNumber,
            sequenceNumber: refSequence,
            clinicalReason: input.clinicalReason.trim(),
            clinicalStatus: 'CLINICALLY_APPROVED',
            isCoveredByContract,
            extraAlignersCount: input.extraAlignersCount,
            extraAmountChargedCents,
            commercialStatus: requiresNewBudget ? 'PENDING_COMMERCIAL_APPROVAL' : 'APPROVED',
            requestedById: sessionUser.userId,
            clinicallyApprovedById: sessionUser.userId,
            clinicallyApprovedAt: now,
          },
        });

        const setupDueAt = calculateSetupDueAt(now, contract.setupSlaBusinessDays || 3);

        const order = await tx.serviceOrder.create({
          data: {
            caseId,
            orderNumber: buildServiceOrderNumber(nextSequence, now),
            sequenceNumber: nextSequence,
            type: 'REFINEMENT',
            status: 'RECEIVED',
            title: `Refinamento #${refSequence}`,
            requiresNewBudget,
            nemoStatus: 'PENDING',
            receivedAt: now,
            setupDueAt,
            refinementRequestId: refinementRecord.id,
            requestedById: sessionUser.userId,
            notes: input.notes || input.clinicalReason.trim(),
          },
        });

        // Evento estritamente operacional (visível para laboratório e clínica sem expor valores financeiros)
        await tx.operationalEvent.create({
          data: {
            caseId,
            serviceOrderId: order.id,
            eventType: 'REFINEMENT_OPENED',
            channel: 'PORTAL',
            summary: `Solicitação de Refinamento #${refSequence} aberta para conferência e novo planejamento`,
            details: null,
            isInternalOnly: false,
            recordedById: sessionUser.userId,
            occurredAt: now,
          },
        });

        if (requiresNewBudget) {
          await tx.operationalEvent.create({
            data: {
              caseId,
              serviceOrderId: order.id,
              eventType: 'COMMERCIAL_NOTE',
              channel: 'INTERNAL',
              summary: `Refinamento #${refSequence} extra-franquia retido para aprovação comercial (${input.extraAlignersCount} pares adicionais)`,
              details: null,
              isInternalOnly: false,
              recordedById: sessionUser.userId,
              occurredAt: now,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            caseId,
            userId: sessionUser.userId,
            organizationId: sessionUser.organizationId,
            membershipId: sessionUser.activeMembershipId,
            action: 'SERVICE_ORDER_REFINEMENT_CREATED',
            entityAffected: 'ServiceOrder',
            payloadDiff: JSON.stringify({
              idempotencyKey,
              serviceOrderId: order.id,
              refinementId: refinementRecord.id,
              sequenceNumber: refSequence,
              contractVersionUsed: contract.versionNumber,
              isCoveredByContract,
              extraAmountChargedCents,
              requiresNewBudget,
              requestedById: sessionUser.userId,
              receivedAt: now.toISOString(),
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });

        return { order, refinement: refinementRecord, refSequence };
      });

      return NextResponse.json(
        {
          message: `Solicitação de Refinamento #${created.refSequence} registrada no tratamento.`,
          serviceOrder: created.order,
          refinement: created.refinement,
        },
        { status: 201 }
      );
    }

    // ========================================================================
    // 3. PEDIDO INICIAL (Caso ainda não exista OS inicial ativa)
    // ========================================================================
    if (!hasPermission(userCtx, 'CASE_CREATE') && !hasPermission(userCtx, 'SUBMIT_CASE')) {
      return NextResponse.json(
        { error: 'Sem permissão para criar OS de Pedido Inicial.' },
        { status: 403 }
      );
    }

    const replayInitial = await findIdempotentAuditReplay(prisma, {
      caseId,
      userId: sessionUser.userId,
      action: 'SERVICE_ORDER_INITIAL_CREATED',
      idempotencyKey,
    });
    if (replayInitial?.serviceOrderId) {
      const existingInitial = await prisma.serviceOrder.findUnique({
        where: { id: replayInitial.serviceOrderId },
      });
      if (existingInitial) {
        return NextResponse.json(
          {
            message: 'OS de Pedido Inicial recuperada de forma idempotente.',
            serviceOrder: existingInitial,
            idempotentReplay: true,
          },
          { status: 200 }
        );
      }
    }

    const setupDueAt = calculateSetupDueAt(
      now,
      treatment.commercialContract?.setupSlaBusinessDays || 3
    );

    const initialOrder = await prisma.$transaction(async (tx) => {
      const existingOrders = await tx.serviceOrder.findMany({
        where: { caseId },
        orderBy: { sequenceNumber: 'asc' },
      });

      const activeInitial = existingOrders.find(
        (so) => so.type === 'INITIAL' && so.status !== 'CANCELLED'
      );
      if (activeInitial) {
        const dupErr: any = new Error(
          `Este tratamento já possui uma OS de Pedido Inicial ativa (${activeInitial.orderNumber}).`
        );
        dupErr.httpStatus = 409;
        dupErr.code = 'DUPLICATE_INITIAL_SERVICE_ORDER';
        throw dupErr;
      }

      const nextSequence = existingOrders.length + 1;
      const order = await tx.serviceOrder.create({
        data: {
          caseId,
          orderNumber: buildServiceOrderNumber(nextSequence, now),
          sequenceNumber: nextSequence,
          type: 'INITIAL',
          status: 'RECEIVED',
          title: input.title || 'Pedido Inicial — Planejamento & 1ª Leva',
          alignerRangeStart: input.alignerRangeStart ?? null,
          alignerRangeEnd: input.alignerRangeEnd ?? null,
          requiresNewBudget: true,
          nemoStatus: 'PENDING',
          receivedAt: now,
          setupDueAt,
          requestedById: sessionUser.userId,
          notes: input.notes || null,
        },
      });

      await tx.operationalEvent.create({
        data: {
          caseId,
          serviceOrderId: order.id,
          eventType: 'INITIAL_SUBMITTED',
          channel: 'PORTAL',
          summary: `OS de Pedido Inicial aberta (${order.orderNumber})`,
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
          action: 'SERVICE_ORDER_INITIAL_CREATED',
          entityAffected: 'ServiceOrder',
          payloadDiff: JSON.stringify({
            idempotencyKey,
            serviceOrderId: order.id,
            orderNumber: order.orderNumber,
            requestedById: sessionUser.userId,
            receivedAt: now.toISOString(),
          }),
          ipAddress: clientIp,
          userAgent,
        },
      });

      return order;
    });

    return NextResponse.json(
      {
        message: 'OS de Pedido Inicial criada com sucesso.',
        serviceOrder: initialOrder,
      },
      { status: 201 }
    );
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
    if (err?.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Conflito de concorrência detectado: solicitação duplicada bloqueada.',
          code: 'CONCURRENT_DUPLICATE_CONFLICT',
        },
        { status: 409 }
      );
    }
    console.error('Erro em POST /service-orders:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao registrar solicitação operacional.' },
      { status: 500 }
    );
  }
}
