import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { calculateProductionDueAt } from '@/lib/sla/treatment-sla';

const approveSchema = z.object({
  professionalAcceptance: z.boolean().refine((v) => v === true, {
    message: 'É obrigatório aceitar a responsabilidade técnica do plano ortodôntico (RN-02).',
  }),
  clinicalNotes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; setupId: string } }
) {
  const { id: caseId, setupId } = params;

  // 1. Guard Central de Autorização: Valida Sessão, Permissão SETUP_APPROVE,
  // Role DOCTOR, CRO_STATUS === VERIFIED e Escopo do Setup/Clínica (Cross-tenant IDOR)
  const auth = await authorize(req, {
    permission: 'SETUP_APPROVE',
    resource: { type: 'SETUP', id: setupId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser, resourceData: targetSetup } = auth;

  // Confirma que o setup pertence ao caseId da rota
  if (targetSetup.caseId !== caseId) {
    return NextResponse.json(
      { error: 'Setup virtual não pertence ao caso informado.', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (targetSetup.status === 'APPROVED') {
    return NextResponse.json(
      { error: 'Este setup virtual já foi aprovado anteriormente.' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { clinicalNotes } = approveSchema.parse(body);

    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = new Date();

    // 1. Atualizar o Setup para APPROVED com rastreio de auditoria
    const updatedSetup = await prisma.setup.update({
      where: { id: setupId },
      data: {
        status: 'APPROVED',
        approvedByDoctorId: sessionUser.userId,
        approvedAt: now,
        approvalIpAddress: clientIp,
      },
    });

    // 2. Gatilho Duplo: Verificar se o contrato comercial já está confirmado
    const existingContract = await prisma.caseCommercialContract.findUnique({
      where: { caseId },
    });

    const isContractConfirmed = existingContract && (existingContract.status === 'CONFIRMED' || existingContract.status === 'AMENDED');
    const finalCaseStatus = isContractConfirmed ? 'IN_PRODUCTION' : 'APPROVED';

    // Transicionar o caso (RN-03: imutabilidade clínica garantida a partir de APPROVED)
    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: finalCaseStatus,
        approvedAt: now,
      },
    });

    // 2.1 Fase B (Matriz v2.0): Atualiza a OS ativa (Pedido Inicial ou Refinamento) e calcula productionDueAt se aplicável
    const activeServiceOrder = await prisma.serviceOrder.findFirst({
      where: {
        caseId,
        type: { in: ['INITIAL', 'REFINEMENT'] },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
      include: {
        refinementRequest: true,
      },
      orderBy: { sequenceNumber: 'desc' },
    });

    if (activeServiceOrder) {
      const isRefinementCommercialOk =
        activeServiceOrder.type !== 'REFINEMENT' ||
        !activeServiceOrder.requiresNewBudget ||
        activeServiceOrder.refinementRequest?.commercialStatus === 'APPROVED' ||
        activeServiceOrder.refinementRequest?.commercialStatus === 'COMMERCIALLY_APPROVED';

      const canReleaseImmediately = Boolean(isContractConfirmed) && isRefinementCommercialOk;

      const productionDueAt = canReleaseImmediately
        ? calculateProductionDueAt(now, {
            days: existingContract?.productionSlaDays,
            dayType: existingContract?.productionSlaDayType,
          })
        : null;

      await prisma.serviceOrder.update({
        where: { id: activeServiceOrder.id },
        data: {
          approvedAt: now,
          productionDueAt: productionDueAt ?? activeServiceOrder.productionDueAt,
          status: canReleaseImmediately ? 'RELEASED_FOR_PRODUCTION' : 'WAITING_PAYMENT',
        },
      });
    }

    await prisma.operationalEvent.create({
      data: {
        caseId,
        serviceOrderId: activeServiceOrder?.id || null,
        eventType: 'SETUP_APPROVED',
        channel: 'PORTAL',
        summary: `Setup virtual v${targetSetup.versionNumber} aprovado clinicamente por ${sessionUser.fullName}`,
        details: clinicalNotes || null,
        isInternalOnly: false,
        recordedById: sessionUser.userId,
        occurredAt: now,
      },
    });

    // 3. F5.03: Geração automática de Ordem de Produção (OP) imutável (Legado Preservado)
    const maxAligners = Math.max(
      targetSetup.upperAlignersCount || 0,
      targetSetup.lowerAlignersCount || 0
    );
    let planType = 'FULL';
    let amount = 4490.0;

    if (maxAligners <= 14) {
      planType = 'LITE';
      amount = 1890.0;
    } else if (maxAligners <= 26) {
      planType = 'MODERATE';
      amount = 2990.0;
    }

    const orderYear = now.getFullYear();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderCode = `OP-${orderYear}-${randomSuffix}`;

    const createdOrder = await prisma.order.create({
      data: {
        caseId,
        orderCode,
        planType,
        amount,
        paymentStatus: 'PENDING',
        contractId: existingContract?.id || null,
      },
    });

    // 4. Registrar em AuditLog com membership e organização
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'SETUP_APPROVED',
        entityAffected: 'Setup',
        payloadDiff: JSON.stringify({
          setupId,
          versionNumber: targetSetup.versionNumber,
          approvedByCro: sessionUser.professionalIdCro,
          orderCode,
          planType,
          amount,
          clientIp,
          clinicalNotes: clinicalNotes || null,
        }),
        ipAddress: clientIp,
        userAgent: req.headers.get('user-agent') || 'Browser/Clinical',
      },
    });

    return NextResponse.json({
      message: 'Setup virtual aprovado com sucesso! Ordem de Produção gerada.',
      setup: updatedSetup,
      order: createdOrder,
      approvedAt: now.toISOString(),
      cro: sessionUser.professionalIdCro,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro ao aprovar setup' },
      { status: 500 }
    );
  }
}
