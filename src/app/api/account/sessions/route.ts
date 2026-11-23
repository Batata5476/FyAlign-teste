import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

const db = prisma as any;

/**
 * DELETE /api/account/sessions
 * Revoga todas as outras sessões ativas do usuário autenticado (ou uma sessão específica via ?sessionId=),
 * preservando a sessão atual quando não especificada.
 */
export async function DELETE(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Não autenticado ou sessão expirada.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const targetSessionId = req.nextUrl.searchParams.get('sessionId');

    if (targetSessionId) {
      const target = await db.session.findFirst({
        where: {
          id: targetSessionId,
          userId: sessionUser.userId,
        },
      });

      if (!target) {
        return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
      }

      await db.session.update({
        where: { id: target.id },
        data: { isValid: false },
      });

      await db.auditLog.create({
        data: {
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'USER_SESSION_REVOKED',
          entityAffected: 'Session',
          payloadDiff: JSON.stringify({ revokedSessionId: target.id }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
        },
      });

      return NextResponse.json({
        success: true,
        revokedCount: 1,
        revokedCurrent: target.id === sessionUser.sessionId,
        message: 'Sessão selecionada encerrada com sucesso.',
      });
    }

    const result = await db.session.updateMany({
      where: {
        userId: sessionUser.userId,
        isValid: true,
        ...(sessionUser.sessionId ? { id: { not: sessionUser.sessionId } } : {}),
      },
      data: {
        isValid: false,
      },
    });

    await db.auditLog.create({
      data: {
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'USER_OTHER_SESSIONS_REVOKED',
        entityAffected: 'Session',
        payloadDiff: JSON.stringify({ revokedCount: result.count }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Web',
      },
    });

    return NextResponse.json({
      success: true,
      revokedCount: result.count,
      message:
        result.count > 0
          ? `${result.count} outra(s) sessão(ões) ativa(s) encerrada(s) com sucesso.`
          : 'Nenhuma outra sessão ativa encontrada.',
    });
  } catch (error: any) {
    console.error('Erro ao revogar sessões:', error);
    return NextResponse.json(
      { error: 'Erro interno ao encerrar sessões.' },
      { status: 500 }
    );
  }
}

