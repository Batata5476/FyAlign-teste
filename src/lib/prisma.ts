import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function resolvePrismaDatasourceUrl(): string | undefined {
  // Em ambiente serverless Vercel com SQLite embarcado, o diretório /var/task é somente leitura.
  // Copiamos o banco pré-populado (prisma/dev.db) para /tmp/dev.db (gravável) no cold start.
  if (process.env.VERCEL) {
    try {
      const tmpDbPath = '/tmp/dev.db';
      if (!fs.existsSync(tmpDbPath)) {
        const bundledCandidates = [
          path.join(process.cwd(), 'prisma', 'dev.db'),
          path.resolve(__dirname, '../../prisma/dev.db'),
          path.resolve(__dirname, '../../../prisma/dev.db'),
        ];
        const sourceDb = bundledCandidates.find((candidate) => fs.existsSync(candidate));
        if (sourceDb) {
          fs.copyFileSync(sourceDb, tmpDbPath);
        }
      }
      if (fs.existsSync(tmpDbPath)) {
        return `file:${tmpDbPath}`;
      }
    } catch (err) {
      console.warn('[Prisma Vercel SQLite] Fallback para datasource padrão:', err);
    }
  }
  return undefined;
}

const runtimeDatasourceUrl = resolvePrismaDatasourceUrl();

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(runtimeDatasourceUrl
      ? { datasources: { db: { url: runtimeDatasourceUrl } } }
      : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Proxy transparente para suportar prisma.clinic mapeando para prisma.organization
export const prisma = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    if (prop === 'clinic') {
      return (target as any).organization;
    }
    return Reflect.get(target, prop, receiver);
  },
}) as PrismaClient & { clinic: any };

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;
