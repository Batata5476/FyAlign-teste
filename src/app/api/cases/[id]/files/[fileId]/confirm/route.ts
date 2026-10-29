import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';

const confirmSchema = z.object({
  etag: z.string().optional(),
  sha256: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id: caseId, fileId } = params;

  const file = await prisma.caseFile.findUnique({
    where: { id: fileId },
    include: { case: true },
  });

  if (!file || file.caseId !== caseId) {
    return NextResponse.json({ error: 'Arquivo não encontrado neste caso' }, { status: 404 });
  }

  if (!isFyAlignInternal(sessionUser.role) && file.case.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { etag, sha256 } = confirmSchema.parse(body);

    const updatedFile = await prisma.caseFile.update({
      where: { id: fileId },
      data: {
        status: 'UPLOADED',
        fileHashSha256: sha256 || etag?.replace(/"/g, '') || null,
      },
    });

    // Registra auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        action: 'CONFIRM_FILE_UPLOAD',
        entityAffected: 'CaseFile',
        payloadDiff: JSON.stringify({ slotNumber: file.slotNumber, fileName: file.originalFileName }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
    });

    return NextResponse.json({ success: true, file: updatedFile });
  } catch (error) {
    console.error('Erro ao confirmar upload:', error);
    return NextResponse.json({ error: 'Erro ao confirmar arquivo.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id: caseId, fileId } = params;

  const file = await prisma.caseFile.findUnique({
    where: { id: fileId },
    include: { case: true },
  });

  if (!file || file.caseId !== caseId) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }

  if (!isFyAlignInternal(sessionUser.role) && file.case.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  if (['APPROVED_BY_DOCTOR', 'IN_PRODUCTION'].includes(file.case.status)) {
    return NextResponse.json({ error: 'Não é permitido excluir arquivos de caso aprovado' }, { status: 400 });
  }

  await prisma.caseFile.delete({
    where: { id: fileId },
  });

  // Registra auditoria
  await prisma.auditLog.create({
    data: {
      caseId,
      userId: sessionUser.userId,
      action: 'DELETE_CASE_FILE',
      entityAffected: 'CaseFile',
      payloadDiff: JSON.stringify({ slotNumber: file.slotNumber, fileName: file.originalFileName }),
      ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Unknown',
    },
  });

  return NextResponse.json({ success: true, message: 'Arquivo removido com sucesso' });
}
