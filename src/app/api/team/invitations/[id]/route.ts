import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hashPassword, generateTemporaryPassword } from '@/lib/auth/password';
import { sendTeamInvitationEmail } from '@/lib/mail/mailer';

const db = prisma as any;

/**
 * POST /api/team/invitations/[id]
 * Reenvia o e-mail de convite gerando uma nova senha temporária segura (quando a conta ainda
 * aguarda o primeiro acesso) e renovando a validade por mais 7 dias.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'TEAM_INVITE' });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const invitation = await db.invitation.findUnique({
      where: { id: params.id },
      include: {
        organization: { select: { id: true, tradeName: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
    }

    if (
      invitation.organizationId !== auth.user.organizationId &&
      auth.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Acesso negado: este convite pertence a outra organização.' },
        { status: 403 }
      );
    }

    if (invitation.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'Este convite foi revogado. Emita um novo convite caso necessário.' },
        { status: 400 }
      );
    }

    const targetUser = await db.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuário associado ao convite não encontrado.' },
        { status: 404 }
      );
    }

    const canResetWithTempPassword = Boolean(
      targetUser.mustChangePassword || !targetUser.lastLoginAt
    );

    const temporaryPassword = canResetWithTempPassword
      ? generateTemporaryPassword(12)
      : null;

    if (temporaryPassword) {
      const passwordHash = await hashPassword(temporaryPassword);
      await db.user.update({
        where: { id: targetUser.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        },
      });
    }

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const emailResult = await sendTeamInvitationEmail({
      recipientEmail: invitation.email,
      recipientName: invitation.fullName || targetUser.fullName || invitation.email,
      organizationName: invitation.organization.tradeName,
      role: invitation.role,
      invitedByName: auth.user.fullName,
      temporaryPassword,
      expiresAt: newExpiresAt,
    });

    const updated = await db.invitation.update({
      where: { id: invitation.id },
      data: {
        expiresAt: newExpiresAt,
        emailDeliveryStatus: emailResult.status,
        emailSentAt: emailResult.delivered ? new Date() : invitation.emailSentAt,
        emailError: emailResult.error || null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        action: 'TEAM_INVITATION_RESENT',
        entityAffected: 'Invitation',
        payloadDiff: JSON.stringify({
          invitationId: invitation.id,
          email: invitation.email,
          regeneratedTemporaryPassword: Boolean(temporaryPassword),
          emailDeliveryStatus: emailResult.status,
          emailProvider: emailResult.provider,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    return NextResponse.json({
      success: true,
      emailDelivery: {
        delivered: emailResult.delivered,
        status: emailResult.status,
        provider: emailResult.provider,
        previewUrl: emailResult.previewUrl || null,
        error: emailResult.error || null,
      },
      message: emailResult.delivered
        ? `Convite reenviado para ${invitation.email} com uma nova senha temporária.`
        : `Nova senha temporária gerada, mas o envio de e-mail falhou: ${emailResult.error || 'provedor não configurado'}.`,
      invitation: {
        id: updated.id,
        status: updated.status,
        emailDeliveryStatus: updated.emailDeliveryStatus,
        emailSentAt: updated.emailSentAt,
        emailError: updated.emailError,
        expiresAt: updated.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('Erro ao reenviar convite:', error);
    return NextResponse.json(
      { error: 'Erro interno ao reenviar convite.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/invitations/[id]
 * Revoga um convite pendente e suspende o vínculo não ativado correspondente.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'TEAM_MANAGE' });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const invitation = await db.invitation.findUnique({
      where: { id: params.id },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
    }

    if (
      invitation.organizationId !== auth.user.organizationId &&
      auth.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Acesso negado: este convite pertence a outra organização.' },
        { status: 403 }
      );
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Apenas convites pendentes podem ser revogados.' },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx: any) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'REVOKED' },
      });

      const invitedUser = await tx.user.findUnique({
        where: { email: invitation.email.toLowerCase() },
      });

      if (invitedUser && invitedUser.mustChangePassword) {
        const pendingMembership = await tx.membership.findFirst({
          where: {
            userId: invitedUser.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });

        if (pendingMembership) {
          await tx.session.updateMany({
            where: { membershipId: pendingMembership.id },
            data: { isValid: false },
          });
          await tx.membership.delete({
            where: { id: pendingMembership.id },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: auth.user.userId,
          organizationId: auth.user.organizationId,
          action: 'TEAM_INVITATION_REVOKED',
          entityAffected: 'Invitation',
          payloadDiff: JSON.stringify({
            invitationId: invitation.id,
            email: invitation.email,
            role: invitation.role,
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Convite para ${invitation.email} revogado com sucesso.`,
    });
  } catch (error: any) {
    console.error('Erro ao revogar convite:', error);
    return NextResponse.json(
      { error: 'Erro interno ao revogar convite.' },
      { status: 500 }
    );
  }
}

