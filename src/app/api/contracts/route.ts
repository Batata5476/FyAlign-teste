import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { formatPatientCode } from '@/lib/patient360/overview-aggregator';
import {
  hasClinicallyApprovedInitialSetup,
  isContractActiveAndConfirmed,
} from '@/lib/domain/treatment-lifecycle';

export async function GET(req: NextRequest) {
  const auth = await authorize(req, { permission: 'CONTRACT_READ' });
  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };
  const canReadPatient = hasPermission(userCtx, 'PATIENT_READ');

  const { searchParams } = new URL(req.url);
  const statusFilter = (searchParams.get('status') || 'ALL').toUpperCase();
  const rawSearch = (searchParams.get('search') || searchParams.get('q') || '').trim().toLowerCase();

  const whereClause: Record<string, any> = {
    OR: [
      { status: { not: 'DRAFT' } },
      { commercialContract: { isNot: null } },
    ],
  };

  if (sessionUser.organizationType === 'CLINIC') {
    whereClause.clinicId = sessionUser.organizationId;
  }

  // Query estritamente comercial/operacional: zero seleção de campos clínicos (anamnese, arquivos, estágios 3D, motivos clínicos)
  const cases = await prisma.case.findMany({
    where: whereClause,
    select: {
      id: true,
      caseCode: true,
      status: true,
      submittedAt: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      patient: {
        select: {
          id: true,
          fullName: true,
        },
      },
      clinic: {
        select: {
          id: true,
          tradeName: true,
          city: true,
          state: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
          professionalIdCro: true,
        },
      },
      setups: {
        select: {
          id: true,
          status: true,
          approvedAt: true,
        },
      },
      commercialContract: {
        include: {
          confirmedBy: {
            select: { id: true, fullName: true },
          },
        },
      },
      refinementRequests: {
        select: {
          id: true,
          isCoveredByContract: true,
          commercialStatus: true,
          extraAmountChargedCents: true,
        },
      },
      productionUnits: {
        select: {
          id: true,
          quantityPairs: true,
          shippedQuantity: true,
          status: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const allItems = cases.map((c) => {
    const patientCode = formatPatientCode(c.patient.id);
    const contract = c.commercialContract;
    const hasInitialApprovedSetup = hasClinicallyApprovedInitialSetup(c.setups);
    const isContractConfirmed = isContractActiveAndConfirmed(contract);
    const pendingCommercialRefinementsCount = c.refinementRequests.filter(
      (r) => r.commercialStatus === 'PENDING_COMMERCIAL_APPROVAL'
    ).length;

    const activeUnits = c.productionUnits.filter(
      (u) => u.status !== 'CANCELLED' && u.status !== 'SCRAPPED'
    );
    const allocatedPairs = activeUnits.reduce((acc, u) => acc + u.quantityPairs, 0);
    const producedPairs = activeUnits
      .filter((u) => u.status === 'QC_PASSED' || u.status === 'SHIPPED')
      .reduce((acc, u) => acc + u.quantityPairs, 0);
    const shippedPairs = activeUnits.reduce((acc, u) => acc + u.shippedQuantity, 0);

    return {
      caseId: c.id,
      caseCode: c.caseCode,
      caseStatus: c.status,
      submittedAt: c.submittedAt,
      approvedAt: c.approvedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      patient: {
        id: canReadPatient ? c.patient.id : null,
        patientCode,
        fullName: canReadPatient ? c.patient.fullName : null,
        piiMinimized: !canReadPatient,
      },
      clinic: c.clinic,
      doctor: c.doctor,
      contract: contract
        ? {
            id: contract.id,
            contractCode: contract.contractCode,
            versionNumber: contract.versionNumber,
            status: contract.status,
            packageName: contract.packageName,
            contractedAligners: contract.contractedAligners,
            totalPriceCents: contract.totalPriceCents,
            currency: contract.currency,
            productionModel: contract.productionModel,
            deliveryModel: contract.deliveryModel,
            includedRefinements: contract.includedRefinements,
            extraAlignerPriceCents: contract.extraAlignerPriceCents,
            setupSlaBusinessDays: contract.setupSlaBusinessDays,
            productionSlaDays: contract.productionSlaDays,
            productionSlaDayType: contract.productionSlaDayType,
            confirmedAt: contract.confirmedAt,
            confirmedBy: contract.confirmedBy,
          }
        : null,
      doubleTrigger: {
        hasInitialApprovedSetup,
        isContractConfirmed,
        satisfied: hasInitialApprovedSetup && isContractConfirmed,
      },
      pendingCommercialRefinementsCount,
      totalRefinementsCount: c.refinementRequests.length,
      deliveries: {
        contractedAligners: contract?.contractedAligners || 0,
        allocatedPairs,
        producedPairs,
        shippedPairs,
      },
    };
  });

  const kpis = {
    totalTreatments: allItems.length,
    withoutProposal: allItems.filter((i) => !i.contract).length,
    awaitingConfirmation: allItems.filter((i) => i.contract?.status === 'DRAFT').length,
    activeConfirmed: allItems.filter(
      (i) => i.contract && (i.contract.status === 'CONFIRMED' || i.contract.status === 'AMENDED')
    ).length,
    pendingCommercialRefinements: allItems.reduce(
      (sum, i) => sum + i.pendingCommercialRefinementsCount,
      0
    ),
    totalConfirmedCents: allItems
      .filter(
        (i) => i.contract && (i.contract.status === 'CONFIRMED' || i.contract.status === 'AMENDED')
      )
      .reduce((sum, i) => sum + (i.contract?.totalPriceCents || 0), 0),
  };

  const filtered = allItems.filter((item) => {
    if (statusFilter === 'WITHOUT_PROPOSAL' && item.contract !== null) return false;
    if (statusFilter === 'DRAFT' && item.contract?.status !== 'DRAFT') return false;
    if (
      statusFilter === 'CONFIRMED' &&
      item.contract?.status !== 'CONFIRMED' &&
      item.contract?.status !== 'AMENDED'
    ) {
      return false;
    }
    if (statusFilter === 'AMENDED' && item.contract?.status !== 'AMENDED') return false;
    if (statusFilter === 'PENDING_REFINEMENT' && item.pendingCommercialRefinementsCount === 0) {
      return false;
    }

    if (rawSearch) {
      // Proteção Anti-Oráculo LGPD: FINANCE (!canReadPatient) jamais filtra por fullName real do paciente
      const searchableTokens = [
        item.caseCode,
        item.patient.patientCode,
        item.contract?.contractCode || '',
        item.contract?.packageName || '',
        item.clinic.tradeName,
        item.doctor.fullName,
        ...(canReadPatient && item.patient.fullName ? [item.patient.fullName] : []),
      ]
        .join(' ')
        .toLowerCase();

      if (!searchableTokens.includes(rawSearch)) {
        return false;
      }
    }

    return true;
  });

  return NextResponse.json({
    kpis,
    items: filtered,
  });
}
