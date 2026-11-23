import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalUploadSignature, getLocalStorageVaultRoot } from '@/lib/storage/s3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const expires = searchParams.get('expires');
    const sig = searchParams.get('sig');

    if (!key || !expires || !sig) {
      return NextResponse.json({ error: 'Parâmetros de upload ausentes' }, { status: 400 });
    }

    const isValid = verifyLocalUploadSignature(key, expires, sig);
    if (!isValid) {
      return NextResponse.json({ error: 'Assinatura inválida ou URL expirada' }, { status: 403 });
    }

    // Lê os bytes recebidos do stream do navegador
    const buffer = Buffer.from(await req.arrayBuffer());

    // Define diretório de armazenamento seguro em disco (usa /tmp/storage-vault em serverless Vercel)
    const targetPath = path.join(getLocalStorageVaultRoot(), key);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, buffer);

    const etag = crypto.createHash('md5').update(buffer).digest('hex');

    const response = new NextResponse(null, { status: 200 });
    response.headers.set('ETag', `"${etag}"`);
    return response;
  } catch (error) {
    console.error('Erro no upload de storage:', error);
    return NextResponse.json({ error: 'Falha ao gravar arquivo' }, { status: 500 });
  }
}
