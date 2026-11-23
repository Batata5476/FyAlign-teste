import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import {
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from '@/lib/auth/password';

const db = prisma as any;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe sua senha atual ou temporária.'),
  newPassword: z.string().min(8, 'A nova senha deve conter no mínimo 8 caracteres.'),
  confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
});

/**
 * POST /api/account/password
 * Redefine a senha do usuário autenticado (tanto no fluxo obrigatório de 1º acesso
 * com senha temporária quanto na área de Configurações da Conta).
 */
export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Não autenticado ou sessão expirada.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = changePasswordSchema.parse(body);

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'A confirmação de senha não coincide com a nova senha informada.' },
        { status: 400 }
      );
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        { error: strength.errors[0], details: strength.errors },
        { status: 400 }
      );
    }

    const dbUser = await db.user.findUnique({
      where: { id: sessionUser.userId },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json(
        { error: 'Conta de usuário não encontrada ou inativa.' },
        { status: 404 }
      );
    }

    const matchesCurrent = await comparePassword(currentPassword, dbUser.passwordHash);
    if (!matchesCurrent) {
      return NextResponse.json(
        { error: 'A senha atual/temporária informada está incorreta.' },
        { status: 400 }
      );
    }

    const isSameAsOld = await comparePassword(newPassword, dbUser.passwordHash);
    if (isSameAsOld) {
      return NextResponse.json(
        { error: 'A nova senha deve ser diferente da senha atual/temporária.' },
        { status: 400 }
      );
    }

    const wasTemporaryPassword = Boolean(dbUser.mustChangePassword);
    const newPasswordHash = await hashPassword(newPassword);
    const now = new Date();

    await db.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          passwordChangedAt: now,
        },
      });

      // Se havia convite(s) pendente(s) para este e-mail, marca como ACCEPTED
      await tx.invitation.updateMany({
        where: {
          email: dbUser.email.toLowerCase(),
          status: 'PENDING',
        },
        data: {
          status: 'ACCEPTED',
          acceptedAt: now,
        },
      });

      // Revoga eventuais outras sessões abertas mantendo a sessão atual ativa
      await tx.session.updateMany({
        where: {
          userId: dbUser.id,
          isValid: true,
          ...(sessionUser.sessionId ? { id: { not: sessionUser.sessionId } } : {}),
        },
        data: {
          isValid: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dbUser.id,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: wasTemporaryPassword
            ? 'INVITATION_PASSWORD_REDEFINED'
            : 'USER_PASSWORD_CHANGED',
          entityAffected: 'User',
          payloadDiff: JSON.stringify({
            firstAccessCompleted: wasTemporaryPassword,
            passwordChangedAt: now.toISOString(),
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
        },
      });
    });

    return NextResponse.json({
      success: true,
      mustChangePassword: false,
      passwordChangedAt: now.toISOString(),
      message: wasTemporaryPassword
        ? 'Senha definitiva configurada com sucesso! Seu acesso completo à plataforma está liberado.'
        : 'Sua senha de acesso foi atualizada com sucesso.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Dados inválidos.' },
        { status: 400 }
      );
    }
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar alteração de senha.' },
      { status: 500 }
    );
  }
}

