import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'DISCONNECTED';
  let latencyMs = 0;

  try {
    // Ping rápido no banco de dados para checagem de liveness/readiness
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
    latencyMs = Date.now() - startTime;

    const memoryUsage = process.memoryUsage();

    return NextResponse.json(
      {
        status: 'HEALTHY',
        service: 'FyAlign B2B Core API',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          latencyMs,
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryRssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
          memoryHeapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        },
        slaTarget: '99.9%',
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'DEGRADED',
        service: 'FyAlign B2B Core API',
        timestamp: new Date().toISOString(),
        database: {
          status: 'ERROR',
          message: error.message,
        },
      },
      { status: 503 }
    );
  }
}
