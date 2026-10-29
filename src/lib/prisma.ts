import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
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
