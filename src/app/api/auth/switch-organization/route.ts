import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { signAccessToken, signRefreshToken, TokenPayload } from '@/lib/auth/jwt';

const switchSchema = z.object({
  membershipId: z.string().min(1, 'membershipId é obrigatório'),
});

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { membershipId } = switchSchema.parse(body);

    // 1. Busca o vínculo solicitado
    const targetMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        organization: true,
      },
    });

    // 2. Trava de Segurança 1: Vínculo DEVE pertencer ao usuário autenticado
    if (!targetMembership || targetMembership.userId !== currentUser.userId) {
      return NextResponse.json(
        {
          error:
            'Acesso negado: O vínculo solicitado não pertence ao seu usuário.',
        },
        { status: 403 }
      );
    }

    // 3. Trava de Segurança 2: Vínculo DEVE estar ativo (não suspenso, não desabilitado)
    if (targetMembership.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: `Acesso negado: Este vínculo está com status ${targetMembership.status}.`,
        },
        { status: 403 }
      );
    }

    // 4. Trava de Segurança 3: Organização DEVE estar ativa
    if (targetMembership.organization.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error:
            'Acesso negado: A organização vinculada está suspensa ou inativa.',
        },
        { status: 403 }
      );
    }

    // 5. Registra nova sessão e revoga a anterior
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    if (currentUser.sessionId) {
      await prisma.session.updateMany({
        where: { id: currentUser.sessionId },
        data: { isValid: false },
      });
    }

    const newSession = await prisma.session.create({
      data: {
        userId: currentUser.userId,
        membershipId: targetMembership.id,
        ipAddress,
        userAgent,
        isValid: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    // 6. Auditoria de Troca de Contexto
    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        organizationId: targetMembership.organizationId,
        membershipId: targetMembership.id,
        action: 'ORGANIZATION_SWITCH',
        entityAffected: 'Session',
        ipAddress,
        userAgent,
        payloadDiff: JSON.stringify({
          fromMembershipId: currentUser.activeMembershipId,
          toMembershipId: targetMembership.id,
          targetRole: targetMembership.role,
        }),
      },
    });

    // 7. Emite Novo JWT de Contexto com o novo Membership/Organization
    const isClinic = targetMembership.organization.type === 'CLINIC';
    const tokenPayload: TokenPayload = {
      userId: currentUser.userId,
      sessionId: newSession.id,
      activeMembershipId: targetMembership.id,
      organizationId: targetMembership.organizationId,
      role: targetMembership.role,
      croStatus: targetMembership.croStatus,
      email: currentUser.email,
      fullName: currentUser.fullName,
      clinicId: isClinic ? targetMembership.organizationId : null,
      professionalIdCro: targetMembership.croNumber
        ? `CRO-${targetMembership.croUf || 'BR'} ${targetMembership.croNumber}`
        : currentUser.professionalIdCro,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken({
      userId: currentUser.userId,
      sessionId: newSession.id,
    });

    const response = NextResponse.json({
      success: true,
      message: `Contexto alterado com sucesso para ${targetMembership.organization.tradeName} (${targetMembership.role}).`,
      activeMembership: {
        id: targetMembership.id,
        role: targetMembership.role,
        croStatus: targetMembership.croStatus,
        organization: {
          id: targetMembership.organization.id,
          tradeName: targetMembership.organization.tradeName,
          type: targetMembership.organization.type,
        },
      },
      accessToken,
    });

    response.cookies.set('fyalign_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    response.cookies.set('fyalign_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Dados inválidos' },
        { status: 400 }
      );
    }
    console.error('Erro na troca de contexto:', error);
    return NextResponse.json(
      { error: 'Erro interno ao alternar organização.' },
      { status: 500 }
    );
  }
}
