import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';
import { extractFdiMentions } from '@/lib/chat/fdiMention';

const createMessageSchema = z.object({
  content: z.string().min(1, { message: 'A mensagem não pode estar vazia.' }),
  isInternalLabOnly: z.boolean().optional().default(false),
  attachmentUrls: z.array(z.string()).optional().default([]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  const isInternal = isFyAlignInternal(sessionUser.role);
  if (!isInternal && clinicalCase.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // F5.09: Se for usuário de clínica, não pode ver notas internas do laboratório
  const messages = await prisma.caseMessage.findMany({
    where: {
      caseId,
      ...(isInternal ? {} : { isInternalLabOnly: false }),
    },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true,
          role: true,
          professionalIdCro: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    caseId,
    messages,
    userRole: sessionUser.role,
    canPostInternal: isInternal,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  const isInternal = isFyAlignInternal(sessionUser.role);
  if (!isInternal && clinicalCase.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { content, isInternalLabOnly, attachmentUrls } = createMessageSchema.parse(body);

    // F5.09: Apenas membros do laboratório podem enviar mensagens com flag interna
    if (isInternalLabOnly && !isInternal) {
      return NextResponse.json(
        { error: 'Apenas a equipe do laboratório FyAlign pode criar notas internas (F5.09).' },
        { status: 403 }
      );
    }

    // F5.07: Extração automática de menções a dentes FDI (#11 a #48)
    const mentionedTeeth = extractFdiMentions(content);

    const message = await prisma.caseMessage.create({
      data: {
        caseId,
        senderId: sessionUser.userId,
        content,
        isInternalLabOnly,
        mentionedTeethFdi: mentionedTeeth.length > 0 ? JSON.stringify(mentionedTeeth) : null,
        attachmentUrls: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            professionalIdCro: true,
          },
        },
      },
    });

    return NextResponse.json({
      message,
      mentionedTeeth,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro ao enviar mensagem' }, { status: 500 });
  }
}
