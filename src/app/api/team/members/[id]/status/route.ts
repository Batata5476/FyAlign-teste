import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const db = prisma as any;

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED'], {
    errorMap: () => ({ message: 'Status deve ser ACTIVE ou SUSPENDED' }),
  }),
});

/**
 * PATCH /api/team/members/[id]/status
 * Atualiza o status do vínculo de um membro (suspensão ou reativação).
 * Efeito imediato: suspensão revoga todas as sessões ativas do vínculo.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'TEAM_MANAGE' });
  if (!auth.authorized) {
    return auth.response;
  }

  const membershipId = params.id;

  try {
    const body = await req.json();
    const { status } = statusSchema.parse(body);

    // 1. Busca o vínculo alvo
    const targetMembership = await db.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Vínculo de membro não encontrado.' },
        { status: 404 }
      );
    }

    // 2. Trava de Isolamento Multi-Tenant: o membro DEVE pertencer à organização ativa
    if (targetMembership.organizationId !== auth.user.organizationId && auth.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado: Este membro não pertence à sua clínica.' },
        { status: 403 }
      );
    }

    // 3. Trava de Auto-Suspensão: não pode suspender o próprio vínculo ativo
    if (targetMembership.id === auth.user.activeMembershipId && status === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Você não pode suspender o seu próprio vínculo ativo de administrador.' },
        { status: 400 }
      );
    }

    // 4. Atualiza o status do vínculo
    const updated = await db.membership.update({
      where: { id: membershipId },
      data: { status },
    });

    // 5. Invalidação imediata de sessões se for SUSPENDED
    if (status === 'SUSPENDED') {
      await db.session.updateMany({
        where: { membershipId: targetMembership.id },
        data: { isValid: false },
      });
    }

    // 6. Trilha de Auditoria
    await db.auditLog.create({
      data: {
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: targetMembership.id,
        action: status === 'SUSPENDED' ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
        entityAffected: 'Membership',
        payloadDiff: JSON.stringify({
          targetUserId: targetMembership.userId,
          targetUserName: targetMembership.user.fullName,
          targetRole: targetMembership.role,
          previousStatus: targetMembership.status,
          newStatus: status,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Membro ${targetMembership.user.fullName} foi ${
        status === 'ACTIVE' ? 'reativado' : 'suspenso'
      } com sucesso.`,
      membership: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Dados inválidos' },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar status do membro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao atualizar membro.' },
      { status: 500 }
    );
  }
}
