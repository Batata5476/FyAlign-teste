import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';

const dispatchSchema = z.object({
  carrierName: z.string().min(2, { message: 'Nome da transportadora é obrigatório (ex: Correios Sedex, Loggi, DHL).' }),
  trackingCode: z.string().min(5, { message: 'Código de rastreamento deve conter no mínimo 5 caracteres.' }),
  shippingNotes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!isFyAlignInternal(sessionUser.role)) {
    return NextResponse.json(
      { error: 'Apenas a equipe de expedição do laboratório pode despachar alinhadores (F5.14).' },
      { status: 403 }
    );
  }

  const caseId = params.id;
  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { carrierName, trackingCode, shippingNotes } = dispatchSchema.parse(body);

    const now = new Date();

    // 1. Atualizar ou criar a Order com os dados de rastreamento
    let targetOrder = clinicalCase.orders[0];
    if (targetOrder) {
      targetOrder = await prisma.order.update({
        where: { id: targetOrder.id },
        data: {
          carrierName,
          trackingCode,
          dispatchedAt: now,
        },
      });
    } else {
      targetOrder = await prisma.order.create({
        data: {
          caseId,
          orderCode: `OP-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          planType: 'FULL',
          amount: 4490.0,
          carrierName,
          trackingCode,
          dispatchedAt: now,
          paymentStatus: 'PENDING',
        },
      });
    }

    // 2. Atualizar o caso para DISPATCHED
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'DISPATCHED',
      },
    });

    // 3. Auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        action: 'ORDER_DISPATCHED',
        entityAffected: 'Order',
        payloadDiff: JSON.stringify({
          orderId: targetOrder.id,
          orderCode: targetOrder.orderCode,
          carrierName,
          trackingCode,
          shippingNotes: shippingNotes || null,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Logistics',
      },
    });

    return NextResponse.json({
      message: 'Alinhadores despachados com sucesso! Rastreamento ativo.',
      case: updatedCase,
      order: targetOrder,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro ao despachar alinhadores' }, { status: 500 });
  }
}
