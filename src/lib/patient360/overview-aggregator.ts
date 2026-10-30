import { prisma } from '@/lib/prisma';
import { AuthUserContext } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import {
  calculateSecondBatchPrepDueAt,
  estimateBatchEndDate,
  evaluateSlaStatus,
} from '@/lib/sla/treatment-sla';

export function formatPatientCode(patientId: string): string {
  const suffix = patientId.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  return `PAC-${suffix}`;
}

export function buildCapabilitiesFor360(user: AuthUserContext) {
  const ctx = { role: user.role, permissions: user.permissions };
  return {
    canReadPatient: hasPermission(ctx, 'PATIENT_READ'),
    canUpdatePatient: hasPermission(ctx, 'PATIENT_UPDATE'),
    canCreateCase: hasPermission(ctx, 'CASE_CREATE') && user.organizationType === 'CLINIC',
    canUpdateCase: hasPermission(ctx, 'CASE_UPDATE'),
    canSubmitCase: hasPermission(ctx, 'SUBMIT_CASE'),
    canReadFiles: hasPermission(ctx, 'FILE_READ'),
    canUploadFiles: hasPermission(ctx, 'FILE_UPLOAD'),
    canVerifyDocs: hasPermission(ctx, 'DOC_VERIFY'),
    canManageNemo: hasPermission(ctx, 'NEMO_MANAGE'),
    canReadSetup: hasPermission(ctx, 'SETUP_READ'),
    canCreateOrPublishSetup:
      hasPermission(ctx, 'SETUP_CREATE') || hasPermission(ctx, 'SETUP_PUBLISH'),
    canApproveSetup: hasPermission(ctx, 'SETUP_APPROVE'),
    canReleaseProduction: hasPermission(ctx, 'PRODUCTION_RELEASE'),
    canReadProductionUnits: hasPermission(ctx, 'PRODUCTION_UNIT_READ'),
    canManageProductionUnits: hasPermission(ctx, 'PRODUCTION_UNIT_MANAGE'),
    canReadQc: hasPermission(ctx, 'QC_READ'),
    canExecuteQc:
      hasPermission(ctx, 'QC_EXECUTE') || hasPermission(ctx, 'PRODUCTION_QC_RELEASE'),
    canReadShipments: hasPermission(ctx, 'SHIPMENT_READ'),
    canManageShipments:
      hasPermission(ctx, 'SHIPMENT_CREATE') || hasPermission(ctx, 'SHIPMENT_DISPATCH'),
    canReadContract: hasPermission(ctx, 'CONTRACT_READ'),
    canCreateContract: hasPermission(ctx, 'CONTRACT_CREATE'),
    canConfirmContract: hasPermission(ctx, 'CONTRACT_CONFIRM'),
    canCommunicateCommercial: hasPermission(ctx, 'COMMERCIAL_COMMUNICATE'),
    canRequestRefinement: hasPermission(ctx, 'REFINEMENT_REQUEST'),
    canTriggerSecondBatch:
      hasPermission(ctx, 'PRODUCTION_UNIT_MANAGE') ||
      hasPermission(ctx, 'PRODUCTION_RELEASE') ||
      hasPermission(ctx, 'CASE_CREATE') ||
      hasPermission(ctx, 'CASE_UPDATE'),
  };
}

const TREATMENT_INCLUDE = {
  doctor: {
    select: {
      id: true,
      fullName: true,
      professionalIdCro: true,
    },
  },
  assignedPlanner: {
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
  clinicalCondition: true,
  treatmentPlan: true,
  files: {
    orderBy: { slotNumber: 'asc' as const },
  },
  setups: {
    orderBy: { versionNumber: 'desc' as const },
  },
  commercialContract: {
    include: {
      confirmedBy: { select: { id: true, fullName: true } },
      versions: { orderBy: { versionNumber: 'desc' as const } },
    },
  },
  productionUnits: {
    include: {
      qcApprovedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  shipments: {
    include: {
      dispatchedBy: { select: { id: true, fullName: true } },
      items: {
        include: {
          productionUnit: {
            select: { id: true, unitCode: true, stagesDescription: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  refinementRequests: {
    include: {
      requestedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { sequenceNumber: 'asc' as const },
  },
  serviceOrders: {
    include: {
      requestedBy: { select: { id: true, fullName: true } },
      docsVerifiedBy: { select: { id: true, fullName: true } },
      nemoInsertedBy: { select: { id: true, fullName: true } },
      productionReleasedBy: { select: { id: true, fullName: true } },
      externalLinks: true,
    },
    orderBy: { sequenceNumber: 'asc' as const },
  },
  operationalEvents: {
    include: {
      recordedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { occurredAt: 'desc' as const },
    take: 40,
  },
  externalLinks: {
    orderBy: { updatedAt: 'desc' as const },
  },
};

export function serializeTreatmentForUser(rawCase: any, user: AuthUserContext) {
  const caps = buildCapabilitiesFor360(user);
  const now = new Date();
  const isClinicViewer = user.organizationType === 'CLINIC';

  const uploadedFiles = (rawCase.files || []).filter(
    (f: any) => f.status === 'UPLOADED' || f.status === 'VERIFIED'
  );

  // ServiceOrders com SLAs em tempo real
  const serviceOrders = (rawCase.serviceOrders || []).map((so: any) => {
    const canSeeNemoDetails =
      caps.canManageNemo ||
      caps.canCreateOrPublishSetup ||
      hasPermission({ role: user.role, permissions: user.permissions }, 'PRODUCTION_READ');

    return {
      id: so.id,
      orderNumber: so.orderNumber,
      sequenceNumber: so.sequenceNumber,
      type: so.type,
      status: so.status,
      title: so.title,
      alignerRangeStart: so.alignerRangeStart,
      alignerRangeEnd: so.alignerRangeEnd,
      requiresNewBudget: so.requiresNewBudget,
      nemo: canSeeNemoDetails
        ? {
            status: so.nemoStatus,
            nemoCaseId: so.nemoCaseId,
            insertedAt: so.nemoInsertedAt,
            insertedBy: so.nemoInsertedBy,
            notes: so.nemoNotes,
            externalLink:
              (so.externalLinks || []).find((l: any) => l.provider === 'NEMO') || null,
          }
        : {
            status: so.nemoStatus,
            nemoCaseId: null,
            insertedAt: so.nemoInsertedAt,
            insertedBy: null,
            notes: null,
            externalLink: null,
          },
      docsVerification: {
        verifiedAt: so.docsVerifiedAt,
        verifiedBy: so.docsVerifiedBy,
        pendingReason: so.docsPendingReason,
      },
      productionRelease: {
        releasedAt: so.productionReleasedAt,
        releasedBy: so.productionReleasedBy,
      },
      receivedAt: so.receivedAt,
      setupSentAt: so.setupSentAt,
      approvedAt: so.approvedAt,
      completedAt: so.completedAt,
      notes: so.notes,
      requestedBy: so.requestedBy,
      slas: {
        setup: evaluateSlaStatus(so.setupDueAt, so.setupSentAt, now),
        production: evaluateSlaStatus(so.productionDueAt, so.completedAt, now),
        secondBatchPrep: evaluateSlaStatus(
          so.scheduledPrepAt,
          so.productionReleasedAt || so.completedAt,
          now
        ),
      },
    };
  });

  // Radar automático da Segunda Leva (ex: pares 1–12 entregues em plano de 24 pares -> gatilho 30d antes)
  const contract = rawCase.commercialContract;
  const totalContractedPairs = contract?.contractedAligners || 0;
  const committedPairsInUnits = (rawCase.productionUnits || []).reduce(
    (sum: number, u: any) => sum + (u.quantityPairs || 0),
    0
  );
  const latestSetup = (rawCase.setups || [])[0] || null;
  const plannedPairsFromSetup = latestSetup
    ? Math.max(latestSetup.upperAlignersCount || 0, latestSetup.lowerAlignersCount || 0)
    : 0;
  const totalExpectedPairs = totalContractedPairs || plannedPairsFromSetup;

  const firstBatchPairs =
    committedPairsInUnits > 0
      ? committedPairsInUnits
      : totalExpectedPairs > 12
      ? Math.ceil(totalExpectedPairs / 2)
      : totalExpectedPairs;

  const hasSecondBatchOrder = (rawCase.serviceOrders || []).some(
    (so: any) => so.type === 'SECOND_BATCH' && so.status !== 'CANCELLED'
  );

  let secondBatchRadar = null;
  if (totalExpectedPairs > firstBatchPairs && firstBatchPairs > 0) {
    const startRef =
      rawCase.shipments?.[0]?.deliveredAt ||
      rawCase.shipments?.[0]?.shippedAt ||
      rawCase.approvedAt ||
      rawCase.createdAt;
    const estimatedCurrentBatchEnd = estimateBatchEndDate(new Date(startRef), firstBatchPairs);
    const prepDueAt = calculateSecondBatchPrepDueAt(estimatedCurrentBatchEnd, 30);

    secondBatchRadar = {
      eligible: !hasSecondBatchOrder,
      alreadyRequested: hasSecondBatchOrder,
      currentBatchRange: `1–${firstBatchPairs}`,
      nextRangeStart: firstBatchPairs + 1,
      nextRangeEnd: totalExpectedPairs,
      estimatedCurrentBatchEndAt: estimatedCurrentBatchEnd.toISOString(),
      prepDueAt: prepDueAt.toISOString(),
      sla: evaluateSlaStatus(prepDueAt, hasSecondBatchOrder ? now : null, now),
    };
  }

  // Filtragem estrita de seções conforme permissões efetivas (RBAC + LGPD)
  const canSeeClinicalDetails = caps.canReadFiles || caps.canUpdateCase;

  return {
    id: rawCase.id,
    caseCode: rawCase.caseCode,
    status: rawCase.status,
    treatedArches: rawCase.treatedArches,
    chiefComplaint: rawCase.chiefComplaint,
    submittedAt: rawCase.submittedAt,
    approvedAt: rawCase.approvedAt,
    createdAt: rawCase.createdAt,
    updatedAt: rawCase.updatedAt,
    doctor: rawCase.doctor,
    assignedPlanner: rawCase.assignedPlanner,
    clinic: rawCase.clinic,

    clinical: canSeeClinicalDetails
      ? {
          angleClass: rawCase.angleClass,
          doctorNotes: rawCase.doctorNotes,
          restrictedTeethFdi: rawCase.restrictedTeethFdi,
          clinicalCondition: rawCase.clinicalCondition,
          treatmentPlan: rawCase.treatmentPlan,
        }
      : null,

    documentation: {
      uploadedCount: uploadedFiles.length,
      totalSlots: 13,
      files: caps.canReadFiles ? rawCase.files : [],
    },

    setups: caps.canReadSetup ? rawCase.setups : [],

    serviceOrders,
    secondBatchRadar,

    productionUnits: caps.canReadProductionUnits
      ? (rawCase.productionUnits || []).map((u: any) => ({
          ...u,
          qcNotes: caps.canReadQc ? u.qcNotes : undefined,
        }))
      : [],

    shipments: caps.canReadShipments ? rawCase.shipments : [],

    refinements: (rawCase.refinementRequests || []).map((r: any) => ({
      id: r.id,
      sequenceNumber: r.sequenceNumber,
      clinicalReason: r.clinicalReason,
      clinicalStatus: r.clinicalStatus,
      isCoveredByContract: r.isCoveredByContract,
      extraAlignersCount: r.extraAlignersCount,
      extraAmountChargedCents: caps.canReadContract ? r.extraAmountChargedCents : undefined,
      commercialStatus: r.commercialStatus,
      requestedBy: r.requestedBy,
      createdAt: r.createdAt,
    })),

    commercialContract:
      caps.canReadContract && contract
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
            usedRefinements: (rawCase.refinementRequests || []).length,
            remainingCoveredRefinements: Math.max(
              0,
              contract.includedRefinements - (rawCase.refinementRequests || []).length
            ),
            refinementWindowDays: contract.refinementWindowDays,
            extraAlignerPriceCents: contract.extraAlignerPriceCents,
            setupSlaBusinessDays: contract.setupSlaBusinessDays,
            productionSlaDays: contract.productionSlaDays,
            productionSlaDayType: contract.productionSlaDayType,
            commercialNotes: contract.commercialNotes,
            confirmedAt: contract.confirmedAt,
            confirmedBy: contract.confirmedBy,
          }
        : null,

    operationalEvents: (rawCase.operationalEvents || []).filter((ev: any) =>
      isClinicViewer ? !ev.isInternalOnly : true
    ),

    externalLinks: (rawCase.externalLinks || []).filter((link: any) => {
      if (link.provider === 'NEMO' && isClinicViewer) return false;
      return true;
    }),
  };
}

export async function buildPatientOverview360(patientId: string, user: AuthUserContext) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      clinic: {
        select: { id: true, tradeName: true, city: true, state: true },
      },
      externalLinks: {
        orderBy: { updatedAt: 'desc' },
      },
      cases: {
        include: TREATMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!patient) return null;

  const capabilities = buildCapabilitiesFor360(user);
  const canReadCases = hasPermission(
    { role: user.role, permissions: user.permissions },
    'CASE_READ'
  );

  return {
    viewMode: 'PATIENT_360' as const,
    capabilities,
    patient: {
      id: patient.id,
      patientCode: formatPatientCode(patient.id),
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      tcleSigned: patient.tcleSigned,
      clinic: patient.clinic,
      externalLinks: patient.externalLinks,
      createdAt: patient.createdAt,
    },
    treatments: canReadCases
      ? patient.cases.map((c) => serializeTreatmentForUser(c, user))
      : [],
  };
}

export async function buildCaseOverview360(caseId: string, user: AuthUserContext) {
  const rawCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: {
        include: {
          clinic: {
            select: { id: true, tradeName: true, city: true, state: true },
          },
          externalLinks: {
            orderBy: { updatedAt: 'desc' },
          },
        },
      },
      ...TREATMENT_INCLUDE,
    },
  });

  if (!rawCase) return null;

  const capabilities = buildCapabilitiesFor360(user);
  const p = rawCase.patient;

  // LGPD Data Minimization: papéis fabris/técnicos sem PATIENT_READ veem apenas identificação essencial da bandeja
  const patientHeader = capabilities.canReadPatient
    ? {
        id: p.id,
        patientCode: formatPatientCode(p.id),
        fullName: p.fullName,
        birthDate: p.birthDate,
        gender: p.gender,
        phone: p.phone,
        email: p.email,
        tcleSigned: p.tcleSigned,
        clinic: p.clinic,
        externalLinks: p.externalLinks,
        createdAt: p.createdAt,
        piiMinimized: false,
      }
    : {
        id: p.id,
        patientCode: formatPatientCode(p.id),
        fullName: p.fullName,
        birthDate: null,
        gender: p.gender,
        phone: null,
        email: null,
        tcleSigned: p.tcleSigned,
        clinic: p.clinic,
        externalLinks: [],
        createdAt: p.createdAt,
        piiMinimized: true,
      };

  return {
    viewMode: 'TREATMENT_360' as const,
    capabilities,
    patient: patientHeader,
    treatments: [serializeTreatmentForUser(rawCase, user)],
  };
}
