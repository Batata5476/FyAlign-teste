import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';
import fs from 'fs';
import path from 'path';
import { s3Client } from '@/lib/storage/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';

/**
 * Endpoint para streaming de STL do estágio (Sprint 1 - Setup Real)
 * GET /api/cases/:id/stages/:stageId/mesh?arch=upper|lower
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id: caseId, stageId } = params;
  const arch = req.nextUrl.searchParams.get('arch')?.toLowerCase() || 'upper';

  const stage = await prisma.setupStage.findUnique({
    where: { id: stageId },
    include: {
      setup: {
        include: {
          case: true,
        },
      },
    },
  });

  if (!stage || stage.setup.caseId !== caseId) {
    return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 });
  }

  if (!isFyAlignInternal(sessionUser.role) && stage.setup.case.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const storageKey = arch === 'lower' ? stage.lowerMeshStorageKey : stage.upperMeshStorageKey;

  if (!storageKey) {
    return NextResponse.json({ error: `Malha ${arch} não cadastrada para este estágio` }, { status: 404 });
  }

  // 1. Produção: Redireciona para Presigned URL do S3/R2 se configurado
  if (s3Client) {
    try {
      const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: storageKey,
      });
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return NextResponse.redirect(presignedUrl);
    } catch (s3Error) {
      console.error('Erro ao gerar URL S3 de download do estágio:', s3Error);
    }
  }

  // 2. Ambiente Local / Dev Mode: busca em storage-vault
  const localFilePath = path.join(process.cwd(), 'storage-vault', storageKey);
  if (!fs.existsSync(localFilePath)) {
    return NextResponse.json(
      { error: `Arquivo físico do estágio não encontrado no storage (${storageKey})` },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(localFilePath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/sla', // MIME standard para STL
      'Content-Disposition': `inline; filename="stage_${stage.stageIndex}_${arch}.stl"`,
      'Content-Length': fileBuffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
