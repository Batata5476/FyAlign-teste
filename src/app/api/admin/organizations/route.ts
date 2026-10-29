import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const db = prisma as any;

/**
 * GET /api/admin/organizations
 * Visão global de todas as organizações cadastradas no FyAlign (Clínicas e Lab Matriz).
 * Acesso exclusivo: SUPER_ADMIN (SYSTEM_ADMIN).
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req, { permission: 'SYSTEM_ADMIN' });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const orgs = await db.organization.findMany({
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            cases: true,
            patients: true,
            memberships: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      organizations: orgs.map((org: any) => ({
        id: org.id,
        tradeName: org.tradeName,
        legalName: org.legalName,
        taxId: org.taxId,
        type: org.type,
        status: org.status,
        city: org.city,
        state: org.state,
        createdAt: org.createdAt,
        totalCases: org._count.cases,
        totalPatients: org._count.patients,
        totalMembers: org._count.memberships,
        members: org.memberships.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          fullName: m.user.fullName,
          email: m.user.email,
          role: m.role,
          status: m.status,
          croStatus: m.croStatus,
        })),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao listar organizações:', error);
    return NextResponse.json(
      { error: 'Erro interno ao consultar organizações.' },
      { status: 500 }
    );
  }
}
