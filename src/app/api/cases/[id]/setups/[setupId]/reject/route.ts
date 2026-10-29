import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { extractFdiMentions } from '@/lib/chat/fdiMention';

const rejectSchema = z.object({
  rejectionReason: z.string().min(10, {
    message: 'A justificativa técnica de ajuste deve conter no mínimo 10 caracteres explicativos.',
  }),
  requestedAdjustments: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; setupId: string } }
) {
  const { id: caseId, setupId } = params;

  // Guard Central: Valida Sessão, Permissão SETUP_REJECT e Escopo do Setup/Clínica
  const auth = await authorize(req, {
    permission: 'SETUP_REJECT',
    resource: { type: 'SETUP', id: setupId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser, resourceData: targetSetup } = auth;

  if (targetSetup.caseId !== caseId) {
    return NextResponse.json(
      { error: 'Setup virtual não pertence ao caso informado.', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (targetSetup.status === 'APPROVED') {
    return NextResponse.json(
      { error: 'Este setup já foi aprovado e a produção foi iniciada. Não é possível rejeitá-lo diretamente.' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { rejectionReason, requestedAdjustments } = rejectSchema.parse(body);

    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = new Date();

    // 1. Atualizar Setup para REJECTED
    const updatedSetup = await prisma.setup.update({
      where: { id: setupId },
      data: {
        status: 'REJECTED',
      },
    });

    // 2. Retornar status do caso para CAD_DESIGN para nova rodada de planejamento
    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'CAD_DESIGN',
      },
    });

    // 3. Gerar mensagem automática no Chat Clínico com menções FDI
    const messageContent =
      `⚠️ SOLICITAÇÃO DE AJUSTE NO SETUP V${targetSetup.versionNumber}:\n\n` +
      `Justificativa: ${rejectionReason}` +
      (requestedAdjustments ? `\n\nModificações requeridas:\n${requestedAdjustments}` : '');

    const detectedFdi = extractFdiMentions(messageContent);

    await prisma.caseMessage.create({
      data: {
        caseId,
        senderId: sessionUser.userId,
        content: messageContent,
        mentionedTeethFdi: detectedFdi.length > 0 ? JSON.stringify(detectedFdi) : null,
        isInternalLabOnly: false,
      },
    });

    // 4. Gravar auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'SETUP_REJECTED',
        entityAffected: 'Setup',
        payloadDiff: JSON.stringify({
          setupId,
          versionNumber: targetSetup.versionNumber,
          rejectionReason,
          requestedAdjustments,
        }),
        ipAddress: clientIp,
        userAgent: req.headers.get('user-agent') || 'Browser/Clinical',
      },
    });

    return NextResponse.json({
      message: 'Solicitação de ajuste enviada ao planejador técnico com sucesso.',
      setup: updatedSetup,
      rejectedAt: now.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro ao rejeitar setup' }, { status: 500 });
  }
}
