import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  // 1. Guard de Autorização: Exige PRODUCTION_READ e escopo de organização LAB (FYALIGN)
  // Bloqueia DOCTOR, CLINIC_ADMIN, CLINIC_ASSISTANT e FINANCE com 403 Forbidden
  const auth = await authorize(req, {
    permission: 'PRODUCTION_READ',
    resource: { type: 'LAB' },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  // 2. Data Minimization: Equipe da fábrica e esteira recebe apenas metadados técnicos de produção
  // Sem fotos faciais, sem CPF, sem prontuário médico completo
  const cases = await prisma.case.findMany({
    where: {
      status: {
        not: 'DRAFT', // Apenas casos já submetidos pelo doutor entram na esteira fabril
      },
    },
    select: {
      id: true,
      caseCode: true,
      status: true,
      treatedArches: true,
      submittedAt: true,
      approvedAt: true,
      updatedAt: true,
      clinic: {
        select: { id: true, tradeName: true, city: true, state: true },
      },
      patient: {
        // Data minimization: apenas código ou identificador mínimo para etiqueta fabril
        select: { id: true, fullName: true },
      },
      doctor: {
        select: { id: true, fullName: true, professionalIdCro: true },
      },
      assignedPlanner: {
        select: { id: true, fullName: true, email: true },
      },
      setups: {
        where: { status: 'APPROVED' },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          upperAlignersCount: true,
          lowerAlignersCount: true,
          modelStorageUrl: true,
        },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
      orders: {
        select: {
          id: true,
          orderCode: true,
          planType: true,
          trackingCode: true,
          carrierName: true,
          paymentStatus: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const now = new Date().getTime();
  const SLA_HOURS_LIMIT = 72; // SLA limite para entrega de setup (72h)

  // Mapeamento e enriquecimento com cálculo de SLA
  const enrichedCases = cases.map((c: any) => {
    let hoursElapsed = 0;
    let isSlaBreached = false;
    let remainingHours = SLA_HOURS_LIMIT;

    if (c.submittedAt) {
      const submittedTime = new Date(c.submittedAt).getTime();
      hoursElapsed = Math.round((now - submittedTime) / (1000 * 60 * 60));
      remainingHours = Math.max(0, SLA_HOURS_LIMIT - hoursElapsed);

      if (hoursElapsed > SLA_HOURS_LIMIT && ['SUBMITTED', 'CAD_DESIGN'].includes(c.status)) {
        isSlaBreached = true;
      }
    }

    return {
      ...c,
      hoursElapsed,
      remainingHours,
      isSlaBreached,
      activeSetup: c.setups[0] || null,
      activeOrder: c.orders[0] || null,
    };
  });

  // Agrupamento por colunas do Kanban
  const kanbanColumns = {
    SUBMITTED: enrichedCases.filter((c: { status: string }) => c.status === 'SUBMITTED'),
    CAD_DESIGN: enrichedCases.filter((c: { status: string }) => c.status === 'CAD_DESIGN'),
    WAITING_DOCTOR_APPROVAL: enrichedCases.filter((c: { status: string }) =>
      ['WAITING_DOCTOR_APPROVAL', 'SETUP_AVAILABLE'].includes(c.status)
    ),
    APPROVED: enrichedCases.filter((c: { status: string }) =>
      ['APPROVED', 'APPROVED_BY_DOCTOR'].includes(c.status)
    ),
    IN_PRODUCTION: enrichedCases.filter((c: { status: string }) => c.status === 'IN_PRODUCTION'),
    QUALITY_CONTROL: enrichedCases.filter((c: { status: string }) => c.status === 'QUALITY_CONTROL'),
    DISPATCHED: enrichedCases.filter((c: { status: string }) => c.status === 'DISPATCHED'),
    DELIVERED: enrichedCases.filter((c: { status: string }) =>
      ['DELIVERED', 'COMPLETED'].includes(c.status)
    ),
  };

  return NextResponse.json({
    totalCases: enrichedCases.length,
    columns: kanbanColumns,
  });
}
