import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import fs from 'fs';
import path from 'path';
import { s3Client } from '@/lib/storage/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';

/**
 * Endpoint para download e visualização de arquivos do caso (STL, PLY, OBJ, Fotos)
 * Protegido com FILE_DOWNLOAD e isolamento estrito contra Cross-Tenant IDOR.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const { id: caseId, fileId } = params;

  // 1. Guard de Autorização: Valida FILE_DOWNLOAD e escopo do arquivo (Cross-Tenant IDOR)
  const auth = await authorize(req, {
    permission: 'FILE_DOWNLOAD',
    resource: { type: 'FILE', id: fileId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { resourceData: file } = auth;

  if (file.caseId !== caseId) {
    return NextResponse.json(
      { error: 'Arquivo não pertence ao caso informado.', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  // Se AWS S3 estiver configurado em produção
  if (s3Client) {
    try {
      const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: file.storageKey,
      });
      const presignedDownloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return NextResponse.redirect(presignedDownloadUrl);
    } catch (s3Error) {
      console.error('Erro ao gerar URL S3 de download:', s3Error);
    }
  }

  // Fallback para storage-vault local (Dev Mode)
  const localFilePath = path.join(process.cwd(), 'storage-vault', file.storageKey);
  if (!fs.existsSync(localFilePath)) {
    return NextResponse.json(
      { error: 'Arquivo não encontrado no storage local', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(localFilePath);
  const response = new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalFileName)}"`,
      'Content-Length': fileBuffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=3600',
    },
  });

  return response;
}
