import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import {
  getAllowedInviteRoles,
  validatePermissionsAgainstCeiling,
  getEffectivePermissions,
  ROLE_CEILINGS,
  ROLE_DEFAULT_PERMISSIONS,
  PERMISSION_MODULES,
  UserRole,
} from '@/lib/auth/rbac';

const db = prisma as any;

const inviteSchema = z.object({
  email: z.string().email('E-mail corporativo/profissional inválido'),
  fullName: z.string().min(2, 'Nome completo deve possuir ao menos 2 caracteres'),
  role: z.string().min(1, 'Papel profissional é obrigatório'),
  croNumber: z.string().optional(),
  croUf: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * GET /api/team
 * Lista os membros e convites da organização ativa do usuário autenticado com suas permissões granulares.
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req, { permission: 'TEAM_READ' });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const members = await db.membership.findMany({
      where: { organizationId: auth.user.organizationId },
      include: {
        permissions: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const invitations = await db.invitation.findMany({
      where: { organizationId: auth.user.organizationId },
      include: {
        permissions: true,
        invitedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      members: members.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        status: m.status,
        croNumber: m.croNumber,
        croUf: m.croUf,
        croStatus: m.croStatus,
        permissions: getEffectivePermissions(m),
        createdAt: m.createdAt,
        lastLoginAt: m.user.lastLoginAt,
        isSelf: m.id === auth.user.activeMembershipId,
      })),
      invitations: invitations.map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        croNumber: inv.croNumber,
        croUf: inv.croUf,
        permissions: inv.permissions.map((p: any) => p.permission),
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        invitedByName: inv.invitedBy.fullName,
      })),
      allowedInviteRoles: getAllowedInviteRoles(auth.user.role),
      roleCeilings: ROLE_CEILINGS,
      roleDefaults: ROLE_DEFAULT_PERMISSIONS,
      permissionModules: PERMISSION_MODULES,
    });
  } catch (error: any) {
    console.error('Erro ao listar equipe:', error);
    return NextResponse.json(
      { error: 'Erro interno ao consultar membros da equipe.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team
 * Envia um novo convite restrito aos papéis permitidos para o autor.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req, { permission: 'TEAM_INVITE' });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await req.json();
    const parsed = inviteSchema.parse(body);

    const allowedRoles = getAllowedInviteRoles(auth.user.role);
    if (!allowedRoles.includes(parsed.role as any)) {
      return NextResponse.json(
        {
          error: `Você não possui autoridade para convidar para o cargo "${parsed.role}". Cargos permitidos: ${allowedRoles.join(
            ', '
          )}`,
        },
        { status: 403 }
      );
    }

    const emailNormalized = parsed.email.toLowerCase().trim();

    // 1. Verifica se já existe um convite pendente para este email na mesma organização
    const existingPendingInvite = await db.invitation.findFirst({
      where: {
        organizationId: auth.user.organizationId,
        email: emailNormalized,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPendingInvite) {
      return NextResponse.json(
        { error: 'Já existe um convite pendente ativo para este e-mail nesta clínica.' },
        { status: 400 }
      );
    }

    // 2. Verifica se o usuário já possui vínculo com esta clínica
    const existingUser = await db.user.findUnique({
      where: { email: emailNormalized },
      include: {
        memberships: {
          where: { organizationId: auth.user.organizationId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: 'Este usuário já possui um vínculo ativo ou registrado nesta clínica.' },
        { status: 400 }
      );
    }

    // 3. Validação das Permissões Granulares contra o Teto do Cargo (ROLE_CEILINGS)
    const permissionsToGrant: string[] =
      parsed.permissions && parsed.permissions.length > 0
        ? parsed.permissions
        : (ROLE_DEFAULT_PERMISSIONS[parsed.role as UserRole] || []);

    const validation = validatePermissionsAgainstCeiling(parsed.role, permissionsToGrant);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `As seguintes permissões excedem o teto permitido para o cargo "${parsed.role}": ${validation.invalidPermissions.join(
            ', '
          )}. O administrador não pode conceder permissões fora do escopo da função.`,
          code: 'FORBIDDEN_PERMISSION_CEILING',
        },
        { status: 400 }
      );
    }

    // 4. Gera hash seguro do token de convite
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 5. Persiste convite e suas permissões atreladas em transação
    const invitation = await db.$transaction(async (tx: any) => {
      const inv = await tx.invitation.create({
        data: {
          organizationId: auth.user.organizationId,
          email: emailNormalized,
          role: parsed.role,
          tokenHash,
          croNumber: parsed.croNumber || null,
          croUf: parsed.croUf ? parsed.croUf.toUpperCase() : null,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
          invitedById: auth.user.userId,
        },
      });

      if (permissionsToGrant.length > 0) {
        await tx.invitationPermission.createMany({
          data: permissionsToGrant.map((p) => ({
            invitationId: inv.id,
            permission: p,
          })),
        });
      }

      return inv;
    });

    // 6. Registro na Trilha de Auditoria
    await db.auditLog.create({
      data: {
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        action: 'TEAM_INVITATION_SENT',
        entityAffected: 'Invitation',
        payloadDiff: JSON.stringify({
          invitationId: invitation.id,
          email: emailNormalized,
          role: parsed.role,
          grantedPermissions: permissionsToGrant,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Convite enviado com sucesso para ${emailNormalized} com ${permissionsToGrant.length} permissões configuradas.`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        permissions: permissionsToGrant,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Dados inválidos' },
        { status: 400 }
      );
    }
    console.error('Erro ao enviar convite:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar convite.' },
      { status: 500 }
    );
  }
}
