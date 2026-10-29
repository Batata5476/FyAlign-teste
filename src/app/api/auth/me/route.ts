import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: sessionUser.userId,
      fullName: sessionUser.fullName,
      email: sessionUser.email,
      role: sessionUser.role,
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
