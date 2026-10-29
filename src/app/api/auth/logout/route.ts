import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (user?.sessionId) {
      // Invalida a sessão gerenciável no banco
      await prisma.session.updateMany({
        where: { id: user.sessionId },
        data: { isValid: false },
      });

      // Auditoria de Logout
      await prisma.auditLog.create({
        data: {
          userId: user.userId,
          organizationId: user.organizationId,
          membershipId: user.activeMembershipId,
          action: 'USER_LOGOUT',
          entityAffected: 'Session',
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
        },
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Sessão encerrada com sucesso.',
    });

    response.cookies.set('fyalign_access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    response.cookies.set('fyalign_refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Erro no logout:', error);
    const response = NextResponse.json({ success: true });
    response.cookies.set('fyalign_access_token', '', { maxAge: 0, path: '/' });
    response.cookies.set('fyalign_refresh_token', '', { maxAge: 0, path: '/' });
    return response;
  }
}
