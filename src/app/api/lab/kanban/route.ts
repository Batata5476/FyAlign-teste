import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const db = prisma as any;

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

  // 2. Data Minimization: Equipe da fábrica e esteira recebe metadados técnicos de produção, OS e SLAs
  const cases = await db.case.findMany({
    where: {
      status: {
        notIn: ['DRAFT', 'CANCELLED'],
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
        select: { id: true, fullName: true },
      },
      doctor: {
        select: { id: true, fullName: true, professionalIdCro: true },
      },
      assignedPlanner: {
        select: { id: true, fullName: true, email: true },
      },
      setups: {
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
      serviceOrders: {
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          nemoStatus: true,
          alignerRangeStart: true,
          alignerRangeEnd: true,
          setupDueAt: true,
          productionDueAt: true,
          scheduledPrepAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      commercialContract: {
        select: {
          id: true,
          contractCode: true,
          status: true,
          packageName: true,
        },
      },
      shipments: {
        select: {
          id: true,
          shipmentCode: true,
          carrier: true,
          trackingCode: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const now = new Date().getTime();
  const SLA_HOURS_LIMIT = 72;

  const enrichedCases = cases.map((c: any) => {
    let hoursElapsed = 0;
    let isSlaBreached = false;
    let remainingHours = SLA_HOURS_LIMIT;

    if (c.submittedAt) {
      const submittedTime = new Date(c.submittedAt).getTime();
      hoursElapsed = Math.round((now - submittedTime) / (1000 * 60 * 60));
      remainingHours = Math.max(0, SLA_HOURS_LIMIT - hoursElapsed);

      if (
        hoursElapsed > SLA_HOURS_LIMIT &&
        ['SUBMITTED', 'IN_TRIAGE', 'TRIAGE', 'PENDING_DOCS', 'CAD_DESIGN', 'IN_PLANNING_3D', 'PLANNING'].includes(
          c.status
        )
      ) {
        isSlaBreached = true;
      }
    }

    const latestShipment = c.shipments?.[0] || null;
    const latestOrder = c.orders?.[0] || null;

    return {
      ...c,
      hoursElapsed,
      remainingHours,
      isSlaBreached,
      activeSetup: c.setups?.[0] || null,
      activeOrder:
        latestOrder ||
        (latestShipment
          ? {
              orderCode: latestShipment.shipmentCode,
              trackingCode: latestShipment.trackingCode,
              carrierName: latestShipment.carrier,
            }
          : null),
      latestServiceOrder: c.serviceOrders?.[0] || null,
      serviceOrdersCount: c.serviceOrders?.length || 0,
      hasPendingSecondBatch: (c.serviceOrders || []).some(
        (so: any) => so.type === 'SECOND_BATCH' && ['RECEIVED', 'SCHEDULED'].includes(so.status)
      ),
      hasActiveRefinement: (c.serviceOrders || []).some(
        (so: any) => so.type === 'REFINEMENT' && so.status !== 'DELIVERED'
      ),
    };
  });

  // Agrupamento completo por colunas do Kanban (nenhum status fica órfão)
  const kanbanColumns = {
    SUBMITTED: enrichedCases.filter((c: { status: string }) =>
      ['SUBMITTED', 'IN_TRIAGE', 'TRIAGE', 'PENDING_DOCS'].includes(c.status)
    ),
    CAD_DESIGN: enrichedCases.filter((c: { status: string }) =>
      ['CAD_DESIGN', 'IN_PLANNING_3D', 'PLANNING', 'ADJUSTMENT_REQUESTED', 'REVISION_REQUESTED', 'REFINEMENT_REQUESTED'].includes(
        c.status
      )
    ),
    WAITING_DOCTOR_APPROVAL: enrichedCases.filter((c: { status: string }) =>
      ['WAITING_DOCTOR_APPROVAL', 'SETUP_AVAILABLE', 'PENDING_APPROVAL'].includes(c.status)
    ),
    APPROVED: enrichedCases.filter((c: { status: string }) =>
      ['APPROVED', 'APPROVED_BY_DOCTOR', 'READY_FOR_PRODUCTION'].includes(c.status)
    ),
    IN_PRODUCTION: enrichedCases.filter((c: { status: string }) => c.status === 'IN_PRODUCTION'),
    QUALITY_CONTROL: enrichedCases.filter((c: { status: string }) =>
      ['QUALITY_CONTROL', 'QC'].includes(c.status)
    ),
    DISPATCHED: enrichedCases.filter((c: { status: string }) =>
      ['DISPATCHED', 'PARTIALLY_SHIPPED', 'SHIPPED'].includes(c.status)
    ),
    DELIVERED: enrichedCases.filter((c: { status: string }) =>
      ['DELIVERED', 'IN_TREATMENT', 'COMPLETED'].includes(c.status)
    ),
  };

  return NextResponse.json({
    totalCases: enrichedCases.length,
    columns: kanbanColumns,
  });
}
