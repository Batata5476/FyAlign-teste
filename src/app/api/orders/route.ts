import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { formatPatientCode } from '@/lib/patient360/overview-aggregator';

export async function GET(req: NextRequest) {
  // 1. Guard de Autorização: Exige ORDER_READ
  // Bloqueia CLINIC_ASSISTANT sem ORDER_READ e PLANNER_3D com 403 Forbidden
  const auth = await authorize(req, {
    permission: 'ORDER_READ',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const isClinic = sessionUser.organizationType === 'CLINIC';
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };
  const canReadPatient = hasPermission(userCtx, 'PATIENT_READ');
  const canReadContract = hasPermission(userCtx, 'CONTRACT_READ');

  // 2. Data Minimization: Informações financeiras/operacionais não expõem PII quando !PATIENT_READ (FINANCE / PRODUCTION_QC)
  const rawOrders = await prisma.order.findMany({
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

  const orders = rawOrders.map((o) => ({
    ...o,
    amount: canReadContract ? o.amount : null,
    case: {
      ...o.case,
      patient: canReadPatient
        ? {
            id: o.case.patient.id,
            patientCode: formatPatientCode(o.case.patient.id),
            fullName: o.case.patient.fullName,
            piiMinimized: false,
          }
        : {
            id: null,
            patientCode: formatPatientCode(o.case.patient.id),
            fullName: null,
            piiMinimized: true,
          },
    },
  }));

  return NextResponse.json({
    orders,
    plansCatalog: canReadContract
      ? [
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
        ]
      : [],
  });
}
