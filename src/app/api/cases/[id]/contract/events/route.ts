import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import {
  extractIdempotencyKey,
  findIdempotentAuditReplay,
} from '@/lib/domain/treatment-lifecycle';

const createCommercialEventSchema = z.object({
  eventType: z.enum(['BUDGET_SENT', 'CLIENT_APPROVAL_RECORDED', 'COMMERCIAL_NOTE']),
  channel: z.enum(['WHATSAPP', 'PORTAL', 'PHONE', 'EMAIL', 'INTERNAL']).default('WHATSAPP'),
  summary: z.string().min(3, 'Informe um resumo da ocorrência comercial (mín. 3 caracteres).'),
  details: z.string().optional().nullable(),
  idempotencyKey: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'COMMERCIAL_COMMUNICATE' });
  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, clinicId: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
  }

  if (
    sessionUser.organizationType === 'CLINIC' &&
    clinicalCase.clinicId !== sessionUser.organizationId
  ) {
    return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
  }

  try {
    const rawBody = await req.json();
    const input = createCommercialEventSchema.parse(rawBody);
    const idempotencyKey = extractIdempotencyKey(req, rawBody);

    const replay = await findIdempotentAuditReplay(prisma, {
      caseId,
      userId: sessionUser.userId,
      action: 'COMMERCIAL_EVENT_RECORDED',
      idempotencyKey,
    });
    if (replay?.eventId) {
      const existingEvent = await prisma.operationalEvent.findUnique({
        where: { id: replay.eventId },
      });
      if (existingEvent) {
        return NextResponse.json(
          { operationalEvent: existingEvent, idempotentReplay: true },
          { status: 200 }
        );
      }
    }

    const now = new Date();
    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'FyAlign/Commercial';

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.operationalEvent.create({
        data: {
          caseId,
          eventType: input.eventType,
          channel: input.channel,
          summary: input.summary.trim(),
          details: input.details?.trim() || null,
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
          action: 'COMMERCIAL_EVENT_RECORDED',
          entityAffected: 'OperationalEvent',
          payloadDiff: JSON.stringify({
            idempotencyKey,
            eventId: created.id,
            eventType: input.eventType,
            channel: input.channel,
            summary: input.summary.trim(),
          }),
          ipAddress: clientIp,
          userAgent,
        },
      });

      return created;
    });

    return NextResponse.json({ operationalEvent: event }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err.message || 'Erro ao registrar ocorrência comercial.' },
      { status: 500 }
    );
  }
}

