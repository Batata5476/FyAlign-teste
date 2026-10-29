import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  // 1. Guard de Autorização: Apenas SUPER_ADMIN possui AUDIT_READ
  // Médicos, Assistentes, Planners, QC e Financeiro são bloqueados com 403 Forbidden
  const auth = await authorize(req, {
    permission: 'AUDIT_READ',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const actionFilter = searchParams.get('action');
  const caseIdFilter = searchParams.get('caseId');
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

  const whereClause: any = {};

  if (actionFilter) {
    whereClause.action = actionFilter;
  }

  if (caseIdFilter) {
    whereClause.caseId = caseIdFilter;
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          professionalIdCro: true,
        },
      },
      case: {
        select: {
          id: true,
          caseCode: true,
          patient: {
            select: { fullName: true },
          },
        },
      },
      organization: {
        select: {
          id: true,
          tradeName: true,
          type: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    total: logs.length,
    logs,
  });
}
