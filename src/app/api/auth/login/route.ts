import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken, TokenPayload } from '@/lib/auth/jwt';
import { getEffectivePermissions } from '@/lib/auth/rbac';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Credenciais inválidas ou conta inativa.' },
        { status: 401 }
      );
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciais inválidas.' },
        { status: 401 }
      );
    }

    // 1. Busca Vínculos Ativos a Organizações Ativas
    const activeMemberships = await prisma.membership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        organization: {
          status: 'ACTIVE',
        },
      },
      include: {
        organization: true,
        permissions: true,
      },
    });

    if (activeMemberships.length === 0) {
      return NextResponse.json(
        {
          error:
            'Acesso recusado: Seu usuário não possui vínculos ativos a nenhuma clínica ou organização credenciada no FyAlign.',
        },
        { status: 403 }
      );
    }

    // Seleciona o primeiro vínculo ativo como padrão
    const activeMembership = activeMemberships[0];

    // 2. Registra Sessão Gerenciável no Banco
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        membershipId: activeMembership.id,
        ipAddress,
        userAgent,
        isValid: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      },
    });

    // 3. Atualiza último login do usuário
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 4. Auditoria imutável do login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: activeMembership.organizationId,
        membershipId: activeMembership.id,
        action: 'USER_LOGIN',
        entityAffected: 'Session',
        ipAddress,
        userAgent,
        payloadDiff: JSON.stringify({
          sessionId: session.id,
          organizationType: activeMembership.organization.type,
          role: activeMembership.role,
        }),
      },
    });

    // 5. Emite Contexto do JWT
    const isClinic = activeMembership.organization.type === 'CLINIC';
    const tokenPayload: TokenPayload = {
      userId: user.id,
      sessionId: session.id,
      activeMembershipId: activeMembership.id,
      organizationId: activeMembership.organizationId,
      role: activeMembership.role,
      croStatus: activeMembership.croStatus,
      email: user.email,
      fullName: user.fullName,
      clinicId: isClinic ? activeMembership.organizationId : null,
      professionalIdCro: activeMembership.croNumber
        ? `CRO-${activeMembership.croUf || 'BR'} ${activeMembership.croNumber}`
        : user.professionalIdCro || null,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        email: user.email,
        role: activeMembership.role,
        permissions: getEffectivePermissions(activeMembership as any),
        croStatus: activeMembership.croStatus,
        activeMembershipId: activeMembership.id,
        organization: {
          id: activeMembership.organization.id,
          tradeName: activeMembership.organization.tradeName,
          type: activeMembership.organization.type,
        },
        memberships: activeMemberships.map((m) => ({
          id: m.id,
          organizationId: m.organizationId,
          organizationName: m.organization.tradeName,
          organizationType: m.organization.type,
          role: m.role,
          status: m.status,
          croStatus: m.croStatus,
          permissions: getEffectivePermissions(m as any),
        })),
        // Compatibilidade legada
        professionalIdCro: tokenPayload.professionalIdCro,
        clinic: isClinic
          ? {
              id: activeMembership.organization.id,
              tradeName: activeMembership.organization.tradeName,
            }
          : null,
      },
      accessToken,
    });

    // Cookies HTTP-Only seguros
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
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar autenticação.' },
      { status: 500 }
    );
  }
}
