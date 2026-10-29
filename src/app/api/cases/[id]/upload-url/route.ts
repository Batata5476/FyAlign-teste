import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { isFyAlignInternal } from '@/lib/auth/rbac';
import { generateUploadUrl, generateAnonymizedStorageKey } from '@/lib/storage/s3';
import { validateFileForSlot, SLOTS_METADATA } from '@/lib/storage/validator';
import { getCaseFileTypeBySlot } from '@/lib/types/clinical';

const uploadUrlSchema = z.object({
  slotNumber: z.number().int().min(1).max(13),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
});

const db = prisma as any;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'FILE_UPLOAD',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;

  const clinicalCase = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso clínico não encontrado' }, { status: 404 });
  }

  // Não permite novos uploads se o caso já estiver aprovado/em produção
  if (['APPROVED_BY_DOCTOR', 'IN_PRODUCTION', 'COMPLETED'].includes(clinicalCase.status)) {
    return NextResponse.json(
      { error: 'Caso bloqueado para alterações após aprovação (RN-03).' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { slotNumber, fileName, mimeType, fileSizeBytes } = uploadUrlSchema.parse(body);

    // Validação estrita do slot pretendido
    const validation = validateFileForSlot(slotNumber, fileName, fileSizeBytes);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const slotMeta = SLOTS_METADATA[slotNumber];

    // Gera chave anonimizada no padrão LGPD (F2.04)
    const storageKey = generateAnonymizedStorageKey(
      clinicalCase.clinicId,
      clinicalCase.id,
      slotNumber,
      fileName
    );

    // Registra ou atualiza o CaseFile como 'UPLOADING'
    const specificType = getCaseFileTypeBySlot(slotNumber) || null;
    let caseFile = await db.caseFile.findFirst({
      where: { caseId: clinicalCase.id, slotNumber },
    });

    if (caseFile) {
      caseFile = await db.caseFile.update({
        where: { id: caseFile.id },
        data: {
          originalFileName: fileName,
          storageKey,
          mimeType,
          fileSizeBytes,
          type: specificType,
          status: 'UPLOADING',
          uploadedById: sessionUser.userId,
        },
      });
    } else {
      caseFile = await db.caseFile.create({
        data: {
          caseId: clinicalCase.id,
          slotNumber,
          category: slotMeta.category,
          type: specificType,
          originalFileName: fileName,
          storageKey,
          mimeType,
          fileSizeBytes,
          status: 'UPLOADING',
          uploadedById: sessionUser.userId,
        },
      });
    }

    // Gera a Presigned URL
    const { uploadUrl, isCloud } = await generateUploadUrl(storageKey, mimeType);

    return NextResponse.json({
      success: true,
      fileId: caseFile.id,
      slotNumber,
      storageKey,
      uploadUrl,
      isCloud,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao gerar upload URL:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitação de upload.' }, { status: 500 });
  }
}
