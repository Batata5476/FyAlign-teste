import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  // 1. Guard de Autorização: Exige ORDER_READ
  // Bloqueia CLINIC_ASSISTANT com 403 Forbidden
  const auth = await authorize(req, {
    permission: 'ORDER_READ',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const isClinic = sessionUser.organizationType === 'CLINIC';

  // 2. Data Minimization: Informações financeiras/contábeis não carregam STLs,
  // nem radiografias, nem prescrições médicas detalhadas
  const orders = await prisma.order.findMany({
    where: isClinic
      ? {
          case: {
            clinicId: sessionUser.organizationId,
          },
        }
      : {},
    include: {
      case: {
        select: {
          id: true,
          caseCode: true,
          status: true,
          patient: {
            select: { id: true, fullName: true },
          },
          doctor: {
            select: { id: true, fullName: true, professionalIdCro: true },
          },
          clinic: {
            select: { id: true, tradeName: true, city: true, state: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    orders,
    plansCatalog: [
      {
        planType: 'LITE',
        name: 'FyAlign Lite',
        limit: 'Até 14 pares',
        price: 1890.0,
        target: 'Recidivas e alinhamentos leves',
      },
      {
        planType: 'MODERATE',
        name: 'FyAlign Moderate',
        limit: 'Até 26 pares',
        price: 2990.0,
        target: 'Casos moderados e apinhamentos médios',
      },
      {
        planType: 'FULL',
        name: 'FyAlign Comprehensive',
        limit: 'Alinhadores ilimitados (5 anos)',
        price: 4490.0,
        target: 'Casos complexos e extrações',
      },
    ],
  });
}
