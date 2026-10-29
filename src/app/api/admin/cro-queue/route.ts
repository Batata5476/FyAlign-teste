import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const db = prisma as any;

/**
 * GET /api/admin/cro-queue
 * Retorna a fila global de validação de habilitação odontológica (CRO).
 * Acesso restrito a SUPER_ADMIN (SYSTEM_ADMIN).
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req, { permission: 'SYSTEM_ADMIN' });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const queue = await db.membership.findMany({
      where: {
        role: 'DOCTOR',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        organization: {
          select: {
            id: true,
            tradeName: true,
            legalName: true,
            taxId: true,
            status: true,
          },
        },
      },
      orderBy: [
        { croStatus: 'asc' }, // PENDING vem primeiro no fluxo
        { updatedAt: 'desc' },
      ],
    });

    const pendingCount = queue.filter((item: any) => item.croStatus === 'PENDING').length;
    const verifiedCount = queue.filter((item: any) => item.croStatus === 'VERIFIED').length;
    const rejectedCount = queue.filter((item: any) => item.croStatus === 'REJECTED').length;

    return NextResponse.json({
      queue: queue.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        phone: m.user.phone,
        organizationId: m.organizationId,
        organizationName: m.organization.tradeName,
        taxId: m.organization.taxId,
        croNumber: m.croNumber,
        croUf: m.croUf,
        croStatus: m.croStatus,
        croVerifiedAt: m.croVerifiedAt,
        status: m.status,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      summary: {
        total: queue.length,
        pending: pendingCount,
        verified: verifiedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error: any) {
    console.error('Erro ao consultar fila de CRO:', error);
    return NextResponse.json(
      { error: 'Erro interno ao consultar fila de habilitação profissional.' },
      { status: 500 }
    );
  }
}
