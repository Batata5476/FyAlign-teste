import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * GET /api/auth/me
 * Fonte oficial do contexto autenticado e das permissões granulares efetivas para o Frontend.
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);

  if (!sessionUser) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: sessionUser.userId,
      name: sessionUser.fullName,
      fullName: sessionUser.fullName,
      email: sessionUser.email,
      phone: sessionUser.phone || null,
      mustChangePassword: Boolean(sessionUser.mustChangePassword),
      passwordChangedAt: sessionUser.passwordChangedAt || null,
      lastLoginAt: sessionUser.lastLoginAt || null,
      createdAt: sessionUser.createdAt || null,
      twoFactorEnabled: Boolean(sessionUser.twoFactorEnabled),
      role: sessionUser.role,
      permissions: sessionUser.permissions,
      croStatus: sessionUser.croStatus,
      activeMembershipId: sessionUser.activeMembershipId,
      organization: {
        id: sessionUser.organizationId,
        tradeName: sessionUser.organizationName,
        type: sessionUser.organizationType,
      },
      memberships: sessionUser.memberships,
      // Compatibilidade legada
      professionalIdCro: sessionUser.professionalIdCro,
      clinic: sessionUser.clinicId
        ? {
            id: sessionUser.clinicId,
            tradeName: sessionUser.organizationName,
          }
        : null,
    },
  });
}
