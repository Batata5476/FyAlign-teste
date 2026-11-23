import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function getLocalStorageVaultRoot(): string {
  if (process.env.VERCEL) {
    return '/tmp/storage-vault';
  }
  return path.join(process.cwd(), 'storage-vault');
}

export function resolveLocalStorageFilePath(storageKey: string): string {
  if (process.env.VERCEL) {
    const tmpCandidate = path.join('/tmp/storage-vault', storageKey);
    if (fs.existsSync(tmpCandidate)) {
      return tmpCandidate;
    }
  }
  return path.join(process.cwd(), 'storage-vault', storageKey);
}

const isRealAwsConfigured =
  env.AWS_ACCESS_KEY_ID &&
  env.AWS_ACCESS_KEY_ID !== 'mock-key' &&
  env.AWS_ACCESS_KEY_ID !== 'mock-aws-access-key-id';

export const s3Client = isRealAwsConfigured
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

/**
 * Gera URL pré-assinada para upload direto via HTTP PUT (F2.03)
 */
export async function generateUploadUrl(
  storageKey: string,
  contentType: string,
  expiresInSeconds = 900 // 15 minutos
): Promise<{ uploadUrl: string; storageKey: string; isCloud: boolean }> {
  if (s3Client) {
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: storageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return { uploadUrl, storageKey, isCloud: true };
  }

  // Fallback Local Seguro (Dev Mode / Testes Locais com HMAC Token)
  const timestamp = Date.now();
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${storageKey}:${timestamp}`)
    .digest('hex');

  const uploadUrl = `/api/storage/upload?key=${encodeURIComponent(
    storageKey
  )}&expires=${timestamp}&sig=${signature}`;

  return { uploadUrl, storageKey, isCloud: false };
}

/**
 * Valida a assinatura de upload local (Dev Mode)
 */
export function verifyLocalUploadSignature(
  storageKey: string,
  timestampStr: string,
  sig: string
): boolean {
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 15 * 60 * 1000) {
    return false; // Expirado após 15 minutos
  }

  const expectedSig = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${storageKey}:${timestamp}`)
    .digest('hex');

  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Gera caminho anonimizado seguro no storage no padrão LGPD (F2.04)
 * Padrão: {clinicId}/{caseId}/{slotNumber}_{uuid}.{ext}
 */
export function generateAnonymizedStorageKey(
  clinicId: string,
  caseId: string,
  slotNumber: number,
  originalFilename: string
): string {
  const fileExt = originalFilename.split('.').pop()?.toLowerCase() || 'bin';
  const fileUuid = crypto.randomUUID();
  return `clinics/${clinicId}/cases/${caseId}/slot_${slotNumber}_${fileUuid}.${fileExt}`;
}
