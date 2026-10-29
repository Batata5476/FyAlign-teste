import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import {
  validatePermissionsAgainstCeiling,
  getEffectivePermissions,
  ROLE_CEILINGS,
  Permission,
} from '@/lib/auth/rbac';

const db = prisma as any;

const updatePermissionsSchema = z.object({
  permissions: z
    .array(z.string())
    .min(1, 'Selecione pelo menos uma permissão de acesso (para bloquear tudo, suspenda o vínculo).'),
});

/**
 * PUT /api/team/members/[id]/permissions
 * Atualiza o conjunto granular de permissões de um membro existente da organização.
 *
 * Regras de Governança Estritas:
 * 1. Exige prerrogativa TEAM_MANAGE no usuário autor.
 * 2. Multi-tenant isolation: o membro deve pertencer à mesma organização.
 * 3. Teto inquebrável (Role Ceiling): nenhuma permissão fora do teto do cargo é aceita.
 * 4. Proteção contra auto-bloqueio: administrador não pode revogar o próprio TEAM_MANAGE.
 * 5. Trilha de Auditoria imutável (AuditLog).
 */
export async function PUT(
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
    const { permissions: requestedPermissions } = updatePermissionsSchema.parse(body);

    // 1. Busca o vínculo alvo
    const targetMembership = await db.membership.findUnique({
      where: { id: membershipId },
      include: {
        permissions: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Vínculo de membro não encontrado.' },
        { status: 404 }
      );
    }

    // 2. Isolamento Multi-Tenant
    if (
      targetMembership.organizationId !== auth.user.organizationId &&
      auth.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Acesso negado: Este membro não pertence à sua organização.' },
        { status: 403 }
      );
    }

    // 3. Validação estrita contra o Teto do Cargo (ROLE_CEILINGS)
    const validation = validatePermissionsAgainstCeiling(
      targetMembership.role,
      requestedPermissions
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Não é permitido conceder permissões fora do teto da função "${targetMembership.role}". Permissões não autorizadas: ${validation.invalidPermissions.join(
            ', '
          )}.`,
          code: 'FORBIDDEN_PERMISSION_CEILING',
        },
        { status: 400 }
      );
    }

    // 4. Prevenção de Auto-Lockout: se for o próprio usuário ativo, não pode remover TEAM_MANAGE
    if (
      targetMembership.id === auth.user.activeMembershipId &&
      !requestedPermissions.includes('TEAM_MANAGE') &&
      auth.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Você não pode revogar a sua própria prerrogativa de gerenciamento de equipe.' },
        { status: 400 }
      );
    }

    const previousPermissions = getEffectivePermissions(targetMembership);

    // 5. Atualização atômica em transação
    await db.$transaction(async (tx: any) => {
      // Remove todas as permissões anteriores
      await tx.membershipPermission.deleteMany({
        where: { membershipId: targetMembership.id },
      });

      // Insere as novas permissões concedidas
      if (requestedPermissions.length > 0) {
        await tx.membershipPermission.createMany({
          data: requestedPermissions.map((perm) => ({
            membershipId: targetMembership.id,
            permission: perm,
          })),
        });
      }
    });

    // 6. Registro na Trilha de Auditoria
    await db.auditLog.create({
      data: {
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: targetMembership.id,
        action: 'MEMBER_PERMISSIONS_UPDATED',
        entityAffected: 'Membership',
        payloadDiff: JSON.stringify({
          targetUserId: targetMembership.userId,
          targetUserName: targetMembership.user.fullName,
          targetRole: targetMembership.role,
          previousPermissions,
          newPermissions: requestedPermissions,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Permissões de ${targetMembership.user.fullName} atualizadas com sucesso.`,
      permissions: requestedPermissions,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Formato de permissões inválido.' },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar permissões do membro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao salvar permissões.' },
      { status: 500 }
    );
  }
}
