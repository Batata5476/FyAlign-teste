import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hashPassword, generateTemporaryPassword } from '@/lib/auth/password';
import {
  getEmailTransportStatus,
  sendTeamInvitationEmail,
} from '@/lib/mail/mailer';
import {
  getAllowedInviteRoles,
  validatePermissionsAgainstCeiling,
  getEffectivePermissions,
  ROLE_CEILINGS,
  ROLE_DEFAULT_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSIONS,
  FREE_PERMISSION_OVERRIDE_MARKER,
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
  allowFreeOverride: z.boolean().optional(),
});

/**
 * GET /api/team
 * Lista os membros e convites da organização ativa do usuário autenticado com suas permissões granulares
 * e diagnóstico de transporte de e-mail.
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
            mustChangePassword: true,
            passwordChangedAt: true,
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
        mustChangePassword: Boolean(m.user.mustChangePassword),
        permissions: getEffectivePermissions(m),
        createdAt: m.createdAt,
        lastLoginAt: m.user.lastLoginAt,
        isSelf: m.id === auth.user.activeMembershipId,
      })),
      invitations: invitations.map((inv: any) => ({
        id: inv.id,
        fullName: inv.fullName || null,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        emailDeliveryStatus: inv.emailDeliveryStatus || 'PENDING',
        emailSentAt: inv.emailSentAt || null,
        emailError: inv.emailError || null,
        croNumber: inv.croNumber,
        croUf: inv.croUf,
        permissions: inv.permissions.map((p: any) => p.permission),
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt || null,
        createdAt: inv.createdAt,
        invitedByName: inv.invitedBy.fullName,
      })),
      emailTransport: getEmailTransportStatus(),
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
 * Cria/provisiona o membro convidado com senha temporária obrigatória no 1º acesso,
 * registra o convite auditável e dispara o e-mail transacional para o destinatário.
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
    const fullNameClean = parsed.fullName.trim();

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
        {
          error:
            'Já existe um convite pendente ativo para este e-mail nesta organização. Utilize "Reenviar Convite" na tabela abaixo caso deseje disparar uma nova senha temporária.',
        },
        { status: 400 }
      );
    }

    // 2. Verifica se o usuário já possui vínculo com esta organização
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
        { error: 'Este usuário já possui um vínculo ativo ou registrado nesta organização.' },
        { status: 400 }
      );
    }

    // 3. Validação das Permissões Granulares (Padrão por Teto ou Edição Livre Confirmada)
    const allValidKeys = new Set<string>(Object.keys(PERMISSIONS));
    const permissionsToGrant: string[] =
      parsed.permissions && parsed.permissions.length > 0
        ? Array.from(new Set(parsed.permissions.filter((p) => allValidKeys.has(p))))
        : ROLE_DEFAULT_PERMISSIONS[parsed.role as UserRole] || [];

    const validation = validatePermissionsAgainstCeiling(parsed.role, permissionsToGrant);
    if (!validation.valid && !parsed.allowFreeOverride) {
      return NextResponse.json(
        {
          error: `As seguintes permissões excedem o teto permitido para o cargo "${parsed.role}": ${validation.invalidPermissions.join(
            ', '
          )}. Ative e confirme o modo "Editar Permissões" para conceder permissões livres.`,
          code: 'FORBIDDEN_PERMISSION_CEILING',
        },
        { status: 400 }
      );
    }

    const persistedPermissions =
      !validation.valid && parsed.allowFreeOverride
        ? [...permissionsToGrant, FREE_PERMISSION_OVERRIDE_MARKER]
        : permissionsToGrant;

    // 4. Define se gera senha temporária (novo usuário ou conta ainda não ativada)
    const isAlreadyActivatedAccount = Boolean(
      existingUser && !existingUser.mustChangePassword && existingUser.lastLoginAt
    );

    const temporaryPassword = isAlreadyActivatedAccount
      ? null
      : generateTemporaryPassword(12);
    const passwordHash = temporaryPassword
      ? await hashPassword(temporaryPassword)
      : null;

    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    const croUfClean = parsed.croUf ? parsed.croUf.toUpperCase() : null;
    const croNumberClean = parsed.croNumber ? parsed.croNumber.trim() : null;

    const orgRecord = await db.organization.findUnique({
      where: { id: auth.user.organizationId },
      select: { id: true, tradeName: true, type: true },
    });

    // 5. Persiste User + Membership + Permissões + Invitation em transação atômica
    const { invitation, provisionedMembershipId } = await db.$transaction(async (tx: any) => {
      let targetUserId: string;

      if (!existingUser) {
        const createdUser = await tx.user.create({
          data: {
            email: emailNormalized,
            fullName: fullNameClean,
            passwordHash: passwordHash!,
            isActive: true,
            mustChangePassword: true,
            role: parsed.role,
            clinicId: orgRecord?.type === 'CLINIC' ? orgRecord.id : null,
            professionalIdCro: croNumberClean
              ? `CRO-${croUfClean || 'BR'} ${croNumberClean}`
              : null,
          },
        });
        targetUserId = createdUser.id;
      } else {
        targetUserId = existingUser.id;
        if (passwordHash) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              mustChangePassword: true,
              isActive: true,
            },
          });
        }
      }

      const createdMembership = await tx.membership.create({
        data: {
          userId: targetUserId,
          organizationId: auth.user.organizationId,
          role: parsed.role,
          status: 'ACTIVE',
          croNumber: croNumberClean,
          croUf: croUfClean,
          croStatus: parsed.role === 'DOCTOR' ? 'PENDING' : 'NOT_REQUIRED',
          invitedById: auth.user.userId,
        },
      });

      if (persistedPermissions.length > 0) {
        await tx.membershipPermission.createMany({
          data: persistedPermissions.map((perm) => ({
            membershipId: createdMembership.id,
            permission: perm,
          })),
        });
      }

      const inv = await tx.invitation.create({
        data: {
          organizationId: auth.user.organizationId,
          fullName: fullNameClean,
          email: emailNormalized,
          role: parsed.role,
          tokenHash,
          croNumber: croNumberClean,
          croUf: croUfClean,
          status: temporaryPassword ? 'PENDING' : 'ACCEPTED',
          acceptedAt: temporaryPassword ? null : new Date(),
          emailDeliveryStatus: 'PENDING',
          expiresAt,
          invitedById: auth.user.userId,
        },
      });

      if (persistedPermissions.length > 0) {
        await tx.invitationPermission.createMany({
          data: persistedPermissions.map((p) => ({
            invitationId: inv.id,
            permission: p,
          })),
        });
      }

      return { invitation: inv, provisionedMembershipId: createdMembership.id };
    });

    // 6. Dispara o e-mail transacional com a senha temporária (nunca logada em texto puro)
    const emailResult = await sendTeamInvitationEmail({
      recipientEmail: emailNormalized,
      recipientName: fullNameClean,
      organizationName: orgRecord?.tradeName || auth.user.organizationName,
      role: parsed.role,
      invitedByName: auth.user.fullName,
      temporaryPassword,
      expiresAt,
    });

    const updatedInvitation = await db.invitation.update({
      where: { id: invitation.id },
      data: {
        emailDeliveryStatus: emailResult.status,
        emailSentAt: emailResult.delivered ? new Date() : null,
        emailError: emailResult.error || null,
      },
    });

    // 7. Registro na Trilha de Auditoria
    await db.auditLog.create({
      data: {
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: provisionedMembershipId,
        action: 'TEAM_INVITATION_SENT',
        entityAffected: 'Invitation',
        payloadDiff: JSON.stringify({
          invitationId: invitation.id,
          email: emailNormalized,
          fullName: fullNameClean,
          role: parsed.role,
          grantedPermissions: permissionsToGrant,
          mustChangePasswordOnFirstLogin: Boolean(temporaryPassword),
          emailDeliveryStatus: emailResult.status,
          emailProvider: emailResult.provider,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    const responseMessage = emailResult.delivered
      ? `Convite enviado por e-mail para ${emailNormalized} com senha temporária e exigência de redefinição no 1º acesso.`
      : `Membro e convite criados para ${emailNormalized}, porém o e-mail não pôde ser entregue (${emailResult.error || 'provedor não configurado'}). Configure o SMTP/Resend e clique em "Reenviar E-mail".`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      emailDelivery: {
        delivered: emailResult.delivered,
        status: emailResult.status,
        provider: emailResult.provider,
        previewUrl: emailResult.previewUrl || null,
        error: emailResult.error || null,
      },
      invitation: {
        id: updatedInvitation.id,
        fullName: updatedInvitation.fullName,
        email: updatedInvitation.email,
        role: updatedInvitation.role,
        status: updatedInvitation.status,
        emailDeliveryStatus: updatedInvitation.emailDeliveryStatus,
        emailSentAt: updatedInvitation.emailSentAt,
        emailError: updatedInvitation.emailError,
        permissions: permissionsToGrant,
        expiresAt: updatedInvitation.expiresAt,
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
