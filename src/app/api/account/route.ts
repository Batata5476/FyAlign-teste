import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getEffectivePermissions, hasPermission } from '@/lib/auth/rbac';
import { getEmailTransportStatus } from '@/lib/mail/mailer';

const db = prisma as any;

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'O nome completo deve conter ao menos 2 caracteres.')
    .max(180, 'Nome completo muito longo.'),
  phone: z
    .string()
    .trim()
    .max(30, 'Telefone inválido.')
    .optional()
    .nullable(),
});

/**
 * GET /api/account
 * Retorna informações completas da conta autenticada, vínculos organizacionais,
 * credencial profissional (CRO), permissões efetivas e sessões ativas.
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Não autenticado ou sessão expirada.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const userRecord = await db.user.findUnique({
      where: { id: sessionUser.userId },
      include: {
        memberships: {
          include: {
            organization: true,
            permissions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        sessions: {
          where: {
            isValid: true,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
    }

    const activeMembership = userRecord.memberships.find(
      (m: any) => m.id === sessionUser.activeMembershipId
    ) || userRecord.memberships[0];

    const canSeeEmailDiagnostics =
      hasPermission(
        { role: sessionUser.role, permissions: sessionUser.permissions },
        'TEAM_INVITE'
      ) ||
      hasPermission(
        { role: sessionUser.role, permissions: sessionUser.permissions },
        'SYSTEM_ADMIN'
      );

    return NextResponse.json({
      account: {
        id: userRecord.id,
        shortId: `USR-${userRecord.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
        fullName: userRecord.fullName,
        email: userRecord.email,
        phone: userRecord.phone || null,
        isActive: userRecord.isActive,
        mustChangePassword: Boolean(userRecord.mustChangePassword),
        passwordChangedAt: userRecord.passwordChangedAt || null,
        twoFactorEnabled: Boolean(userRecord.twoFactorEnabled),
        lastLoginAt: userRecord.lastLoginAt || null,
        createdAt: userRecord.createdAt,
      },
      activeOrganization: activeMembership
        ? {
            id: activeMembership.organization.id,
            tradeName: activeMembership.organization.tradeName,
            legalName: activeMembership.organization.legalName,
            taxId: activeMembership.organization.taxId,
            type: activeMembership.organization.type,
            status: activeMembership.organization.status,
            city: activeMembership.organization.city,
            state: activeMembership.organization.state,
            phone: activeMembership.organization.phone,
          }
        : null,
      activeMembership: activeMembership
        ? {
            id: activeMembership.id,
            role: activeMembership.role,
            status: activeMembership.status,
            croNumber: activeMembership.croNumber || null,
            croUf: activeMembership.croUf || null,
            croStatus: activeMembership.croStatus,
            croVerifiedAt: activeMembership.croVerifiedAt || null,
            permissions: getEffectivePermissions(activeMembership),
            createdAt: activeMembership.createdAt,
          }
        : null,
      memberships: userRecord.memberships.map((m: any) => ({
        id: m.id,
        organizationId: m.organizationId,
        organizationName: m.organization.tradeName,
        organizationType: m.organization.type,
        organizationStatus: m.organization.status,
        role: m.role,
        status: m.status,
        croNumber: m.croNumber || null,
        croUf: m.croUf || null,
        croStatus: m.croStatus,
        isCurrent: m.id === sessionUser.activeMembershipId,
        permissionsCount: getEffectivePermissions(m).length,
      })),
      sessions: userRecord.sessions.map((s: any) => ({
        id: s.id,
        ipAddress: s.ipAddress || 'Não identificado',
        userAgent: s.userAgent || 'Navegador Web',
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.id === sessionUser.sessionId,
      })),
      emailTransport: canSeeEmailDiagnostics ? getEmailTransportStatus() : null,
    });
  } catch (error: any) {
    console.error('Erro ao consultar conta:', error);
    return NextResponse.json(
      { error: 'Erro interno ao consultar dados da conta.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account
 * Atualiza informações cadastrais básicas do próprio usuário (Nome completo e Telefone).
 */
export async function PATCH(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Não autenticado ou sessão expirada.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  if (sessionUser.mustChangePassword) {
    return NextResponse.json(
      {
        error: 'Redefina sua senha temporária antes de editar dados cadastrais.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.parse(body);

    const previous = await db.user.findUnique({
      where: { id: sessionUser.userId },
      select: { fullName: true, phone: true },
    });

    const updated = await db.user.update({
      where: { id: sessionUser.userId },
      data: {
        fullName: parsed.fullName,
        phone: parsed.phone ? parsed.phone.trim() : null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'ACCOUNT_PROFILE_UPDATED',
        entityAffected: 'User',
        payloadDiff: JSON.stringify({
          previous,
          updated: {
            fullName: updated.fullName,
            phone: updated.phone,
          },
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Informações da conta atualizadas com sucesso.',
      account: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Dados inválidos.' },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar conta:', error);
    return NextResponse.json(
      { error: 'Erro interno ao atualizar dados da conta.' },
      { status: 500 }
    );
  }
}

