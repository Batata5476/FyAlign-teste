import { cookies, headers } from 'next/headers';
import { verifyAccessToken, TokenPayload } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma';
import { getEffectivePermissions, Permission } from '@/lib/auth/rbac';

export interface MembershipSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  role: string;
  status: string;
  croStatus: string;
  permissions: string[];
}

export interface AuthUserContext {
  userId: string;
  sessionId: string;
  activeMembershipId: string;
  organizationId: string;
  organizationType: string;
  organizationName: string;
  role: string;
  croStatus: string; // Sempre revalidado contra o banco
  email: string;
  fullName: string;
  permissions: Permission[]; // Permissões granulares efetivas do vínculo ativo
  memberships: MembershipSummary[];

  // Campos de compatibilidade para código e queries legadas
  clinicId: string | null;
  professionalIdCro: string | null;
}

/**
 * Obtém e revalida o contexto do usuário autenticado a cada requisição.
 * O banco de dados (Membership + Organization) é a única fonte da verdade.
 */
export async function getCurrentUser(req?: any): Promise<AuthUserContext | null> {
  let token: string | undefined;
  let refreshTokenValue: string | undefined;

  if (req) {
    if (req.cookies?.get) {
      token = req.cookies.get('fyalign_access_token')?.value;
      refreshTokenValue = req.cookies.get('fyalign_refresh_token')?.value;
    }
    if (!token && req.headers?.get) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/fyalign_access_token=([^;]+)/);
        if (match) token = match[1];
      }
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
  }

  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get('fyalign_access_token')?.value;
      refreshTokenValue = cookieStore.get('fyalign_refresh_token')?.value;

      if (!token) {
        const reqHeaders = headers();
        const authHeader = reqHeaders.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
    } catch {
      // Ignora erro fora do escopo de requisição do Next.js (ex: CLI / testes)
    }
  }

  let payload: TokenPayload | null = null;
  if (token) {
    payload = await verifyAccessToken(token);
  }

  // Fallback para Refresh Token caso o access token tenha expirado
  let fallbackUserId: string | null = null;
  let fallbackSessionId: string | null = null;

  if (!payload && refreshTokenValue) {
    const { verifyRefreshToken } = await import('@/lib/auth/jwt');
    const refreshPayload = await verifyRefreshToken(refreshTokenValue);
    if (refreshPayload?.userId) {
      fallbackUserId = refreshPayload.userId;
      fallbackSessionId = refreshPayload.sessionId || null;
    }
  }

  const effectiveUserId = payload?.userId || fallbackUserId;
  if (!effectiveUserId) return null;

  // 1. Revalida Pessoa Física (User)
  const user = await prisma.user.findUnique({
    where: { id: effectiveUserId },
  });

  if (!user || !user.isActive) {
    return null;
  }

  // 2. Valida Sessão Ativa (se sessionId estiver disponível)
  const targetSessionId = payload?.sessionId || fallbackSessionId;
  if (targetSessionId) {
    const session = await prisma.session.findUnique({
      where: { id: targetSessionId },
    });

    if (session && (!session.isValid || session.expiresAt < new Date())) {
      // Sessão foi revogada administrativamente ou expirou
      return null;
    }
  }

  // 3. Busca Vínculos Ativos do Usuário
  const availableMemberships = await prisma.membership.findMany({
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

  if (availableMemberships.length === 0) {
    // Usuário suspenso ou sem vínculos a organizações ativas
    return null;
  }

  // 4. Determina e Revalida o Vínculo Ativo (Active Membership)
  let activeMembership: typeof availableMemberships[0] | null = null;

  if (payload?.activeMembershipId) {
    const targetMembership = await prisma.membership.findUnique({
      where: { id: payload.activeMembershipId },
      include: {
        organization: true,
        permissions: true,
      },
    });

    // Se o vínculo especificado no JWT não existe, não pertence ao usuário,
    // está SUSPENDED/DISABLED ou pertence a uma organização inativa -> Acesso morre imediatamente!
    if (
      !targetMembership ||
      targetMembership.userId !== user.id ||
      targetMembership.status !== 'ACTIVE' ||
      targetMembership.organization.status !== 'ACTIVE'
    ) {
      return null;
    }

    activeMembership = targetMembership;
  } else {
    // Fallback apenas para tokens legados sem activeMembershipId
    activeMembership = availableMemberships[0];
  }

  if (!activeMembership) {
    return null;
  }

  if (activeMembership.organization.status !== 'ACTIVE') {
    return null;
  }

  const isClinic = activeMembership.organization.type === 'CLINIC';
  const effectivePermissions = getEffectivePermissions(activeMembership as any);

  return {
    userId: user.id,
    sessionId: targetSessionId || activeMembership.id,
    activeMembershipId: activeMembership.id,
    organizationId: activeMembership.organizationId,
    organizationType: activeMembership.organization.type,
    organizationName: activeMembership.organization.tradeName,
    role: activeMembership.role,
    croStatus: activeMembership.croStatus, // Valor fresco diretamente do banco
    email: user.email,
    fullName: user.fullName,
    permissions: effectivePermissions,
    memberships: availableMemberships.map((m: any) => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.tradeName,
      organizationType: m.organization.type,
      role: m.role,
      status: m.status,
      croStatus: m.croStatus,
      permissions: getEffectivePermissions(m),
    })),
    clinicId: isClinic ? activeMembership.organizationId : null,
    professionalIdCro: activeMembership.croNumber
      ? `CRO-${activeMembership.croUf || 'BR'} ${activeMembership.croNumber}`
      : user.professionalIdCro || null,
  };
}

export async function requireAuth(): Promise<AuthUserContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export async function requireClinic(): Promise<{ user: AuthUserContext; clinicId: string }> {
  const user = await requireAuth();
  if (!user.clinicId) {
    throw new Error('FORBIDDEN_NOT_A_CLINIC_MEMBER');
  }
  return { user, clinicId: user.clinicId };
}
