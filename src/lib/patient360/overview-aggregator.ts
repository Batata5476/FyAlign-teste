import { prisma } from '@/lib/prisma';
import { AuthUserContext } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import {
  calculateSecondBatchPrepDueAt,
  estimateBatchEndDate,
  evaluateSlaStatus,
} from '@/lib/sla/treatment-sla';
import {
  hasClinicallyApprovedInitialSetup,
  isCommercialEventType,
  isContractActiveAndConfirmed,
  validateAdditionalOrderPrerequisites,
} from '@/lib/domain/treatment-lifecycle';

export function formatPatientCode(patientId: string): string {
  const suffix = patientId.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  return `PAC-${suffix}`;
}

export function buildCapabilitiesFor360(user: AuthUserContext) {
  const ctx = { role: user.role, permissions: user.permissions };
  const isDoctorCroVerified = user.role !== 'DOCTOR' || user.croStatus === 'VERIFIED';

  return {
    canReadPatient: hasPermission(ctx, 'PATIENT_READ'),
    canUpdatePatient: hasPermission(ctx, 'PATIENT_UPDATE'),
    canReadCase: hasPermission(ctx, 'CASE_READ'),
    canCreateCase: hasPermission(ctx, 'CASE_CREATE') && user.organizationType === 'CLINIC',
    canUpdateCase: hasPermission(ctx, 'CASE_UPDATE'),
    canSubmitCase: hasPermission(ctx, 'SUBMIT_CASE') && isDoctorCroVerified,
    canReadFiles: hasPermission(ctx, 'FILE_READ'),
    canUploadFiles: hasPermission(ctx, 'FILE_UPLOAD'),
    canVerifyDocs: hasPermission(ctx, 'DOC_VERIFY'),
    canScheduleSecondBatch:
      user.organizationType === 'FYALIGN' &&
      (hasPermission(ctx, 'DOC_VERIFY') || hasPermission(ctx, 'SCHEDULE_UPDATE')),
    canManageNemo: hasPermission(ctx, 'NEMO_MANAGE'),
    canReadSetup: hasPermission(ctx, 'SETUP_READ'),
    canCreateOrPublishSetup:
      hasPermission(ctx, 'SETUP_CREATE') || hasPermission(ctx, 'SETUP_PUBLISH'),
    canApproveSetup: hasPermission(ctx, 'SETUP_APPROVE') && isDoctorCroVerified,
    canReleaseProduction:
      user.organizationType === 'FYALIGN' && hasPermission(ctx, 'PRODUCTION_RELEASE'),
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
    canAmendContract: hasPermission(ctx, 'CONTRACT_AMEND'),
    canApproveRefinementCommercial: hasPermission(ctx, 'REFINEMENT_COMMERCIAL_APPROVE'),
    canCommunicateCommercial: hasPermission(ctx, 'COMMERCIAL_COMMUNICATE'),
    canRequestRefinement: hasPermission(ctx, 'REFINEMENT_REQUEST') && isDoctorCroVerified,
    // Decisão Aprovada #2: Gatilho direto da Segunda Leva exclusivo para DOCTOR com CRO VERIFIED
    canTriggerSecondBatch:
      user.role === 'DOCTOR' &&
      user.croStatus === 'VERIFIED' &&
      hasPermission(ctx, 'CASE_READ'),
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
      versions: {
        include: {
          changedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { versionNumber: 'desc' as const },
      },
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
      commerciallyApprovedBy: { select: { id: true, fullName: true } },
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
    take: 50,
  },
  externalLinks: {
    orderBy: { updatedAt: 'desc' as const },
  },
};

function buildCommercialContractPayload(contract: any, refinementRequests: any[]) {
  if (!contract) return null;
  const coveredRefinementsUsed = (refinementRequests || []).filter(
    (r: any) => Boolean(r.isCoveredByContract)
  ).length;

  return {
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
    usedRefinements: (refinementRequests || []).length,
    coveredRefinementsUsed,
    remainingCoveredRefinements: Math.max(
      0,
      contract.includedRefinements - coveredRefinementsUsed
    ),
    refinementWindowDays: contract.refinementWindowDays,
    extraAlignerPriceCents: contract.extraAlignerPriceCents,
    setupSlaBusinessDays: contract.setupSlaBusinessDays,
    productionSlaDays: contract.productionSlaDays,
    productionSlaDayType: contract.productionSlaDayType,
    commercialNotes: contract.commercialNotes,
    confirmedAt: contract.confirmedAt,
    confirmedBy: contract.confirmedBy,
    versions: (contract.versions || []).map((v: any) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      contractedAligners: v.contractedAligners,
      totalPriceCents: v.totalPriceCents,
      productionModel: v.productionModel,
      deliveryModel: v.deliveryModel,
      includedRefinements: v.includedRefinements,
      refinementWindowDays: v.refinementWindowDays,
      extraAlignerPriceCents: v.extraAlignerPriceCents,
      setupSlaBusinessDays: v.setupSlaBusinessDays,
      productionSlaDays: v.productionSlaDays,
      productionSlaDayType: v.productionSlaDayType,
      changeReason: v.changeReason,
      changedBy: v.changedBy || null,
      createdAt: v.createdAt,
    })),
  };
}

function buildDeliveriesSummary(rawCase: any) {
  const contract = rawCase.commercialContract;
  const units = rawCase.productionUnits || [];
  const activeUnits = units.filter(
    (u: any) => u.status !== 'CANCELLED' && u.status !== 'SCRAPPED'
  );
  const allocatedPairs = activeUnits.reduce(
    (sum: number, u: any) => sum + (u.quantityPairs || 0),
    0
  );
  const producedPairs = activeUnits
    .filter((u: any) => u.status === 'QC_PASSED' || u.status === 'SHIPPED')
    .reduce((sum: number, u: any) => sum + (u.quantityPairs || 0), 0);
  const shippedPairs = activeUnits.reduce(
    (sum: number, u: any) => sum + (u.shippedQuantity || 0),
    0
  );

  return {
    contractedAligners: contract?.contractedAligners || 0,
    allocatedPairs,
    producedPairs,
    shippedPairs,
    batchesCount: activeUnits.length,
    shipmentsCount: (rawCase.shipments || []).length,
  };
}

/**
 * Modo Estritamente Comercial (Dr. Paulo / FINANCE — sem CASE_READ nem PATIENT_READ):
 * Redação total no backend: zero fotos, zero STLs, zero anamnese/diagnóstico, zero setups 3D,
 * zero motivos clínicos de refinamento e paciente pseudonimizado como PAC-XXXX.
 */
function serializeTreatmentCommercialOnly(rawCase: any, user: AuthUserContext) {
  const contract = rawCase.commercialContract;
  const isClinicViewer = user.organizationType === 'CLINIC';
  const hasInitialApprovedSetup = hasClinicallyApprovedInitialSetup(rawCase.setups);
  const isContractConfirmed = isContractActiveAndConfirmed(contract);
  const prereq = validateAdditionalOrderPrerequisites(rawCase);

  return {
    id: rawCase.id,
    caseCode: rawCase.caseCode,
    status: rawCase.status,
    treatedArches: null,
    chiefComplaint: null,
    submittedAt: rawCase.submittedAt,
    approvedAt: rawCase.approvedAt,
    createdAt: rawCase.createdAt,
    updatedAt: rawCase.updatedAt,
    doctor: rawCase.doctor,
    assignedPlanner: null,
    clinic: rawCase.clinic,

    clinical: null,

    documentation: {
      uploadedCount: 0,
      totalSlots: 0,
      files: [],
    },

    setups: [],
    serviceOrders: [],
    secondBatchRadar: null,

    additionalOrderGate: {
      allowed: prereq.ok,
      code: prereq.code || null,
      reason: prereq.error || null,
    },

    commercialGateSummary: {
      hasInitialApprovedSetup,
      isContractConfirmed,
      doubleTriggerSatisfied: hasInitialApprovedSetup && isContractConfirmed,
    },

    deliveriesSummary: buildDeliveriesSummary(rawCase),

    productionUnits: (rawCase.productionUnits || []).map((u: any) => ({
      id: u.id,
      unitCode: u.unitCode,
      type: u.type,
      quantityPairs: u.quantityPairs,
      shippedQuantity: u.shippedQuantity,
      stagesDescription: u.stagesDescription,
      status: u.status,
      plannedStartDate: u.plannedStartDate,
      plannedEndDate: u.plannedEndDate,
      refinementRequestId: u.refinementRequestId,
      createdAt: u.createdAt,
    })),

    shipments: (rawCase.shipments || []).map((s: any) => ({
      id: s.id,
      shipmentCode: s.shipmentCode,
      carrierName: s.carrierName,
      trackingCode: s.trackingCode,
      status: s.status,
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      items: s.items,
      createdAt: s.createdAt,
    })),

    refinements: (rawCase.refinementRequests || []).map((r: any) => ({
      id: r.id,
      sequenceNumber: r.sequenceNumber,
      contractVersionUsed: r.contractVersionUsed,
      clinicalReason: null, // Redigido estritamente no modo comercial (LGPD)
      clinicalStatus: r.clinicalStatus,
      isCoveredByContract: r.isCoveredByContract,
      extraAlignersCount: r.extraAlignersCount,
      extraAmountChargedCents: r.extraAmountChargedCents,
      commercialStatus: r.commercialStatus,
      commerciallyApprovedBy: r.commerciallyApprovedBy || null,
      commerciallyApprovedAt: r.commerciallyApprovedAt || null,
      requestedBy: r.requestedBy,
      createdAt: r.createdAt,
    })),

    commercialContract: buildCommercialContractPayload(
      contract,
      rawCase.refinementRequests || []
    ),

    operationalEvents: (rawCase.operationalEvents || []).filter((ev: any) => {
      if (isClinicViewer && ev.isInternalOnly) return false;
      return isCommercialEventType(ev.eventType);
    }),

    externalLinks: (rawCase.externalLinks || []).filter(
      (link: any) => link.provider === 'ERP_FINANCIAL'
    ),
  };
}

export function serializeTreatmentForUser(rawCase: any, user: AuthUserContext) {
  const caps = buildCapabilitiesFor360(user);

  if (!caps.canReadCase && caps.canReadContract) {
    return serializeTreatmentCommercialOnly(rawCase, user);
  }

  const now = new Date();
  const isClinicViewer = user.organizationType === 'CLINIC';
  const canSeeCommercialTimeline = caps.canReadContract || caps.canCommunicateCommercial;

  const uploadedFiles = (rawCase.files || []).filter(
    (f: any) => f.status === 'UPLOADED' || f.status === 'VERIFIED'
  );

  // ServiceOrders com SLAs em tempo real
  const serviceOrders = (rawCase.serviceOrders || []).map((so: any) => {
    const canSeeNemoDetails =
      !isClinicViewer &&
      (caps.canManageNemo ||
        caps.canCreateOrPublishSetup ||
        hasPermission({ role: user.role, permissions: user.permissions }, 'PRODUCTION_READ'));

    return {
      id: so.id,
      orderNumber: so.orderNumber,
      sequenceNumber: so.sequenceNumber,
      type: so.type,
      status: so.status,
      title: so.title,
      alignerRangeStart: so.alignerRangeStart,
      alignerRangeEnd: so.alignerRangeEnd,
      requiresNewBudget: caps.canReadContract ? so.requiresNewBudget : false,
      refinementRequestId: so.refinementRequestId || null,
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
      scheduledPrepAt: so.scheduledPrepAt,
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

  // Validação dos pré-requisitos para Segunda Leva e Refinamento
  const contract = rawCase.commercialContract;
  const hasInitialApprovedSetup = hasClinicallyApprovedInitialSetup(rawCase.setups);
  const isContractConfirmed = isContractActiveAndConfirmed(contract);
  const prereq = validateAdditionalOrderPrerequisites(rawCase);

  // Radar automático da Segunda Leva (EXCLUSIVO quando Setup aprovado + Contrato confirmado + 1ª leva física alocada < total contratado)
  const totalContractedPairs = contract?.contractedAligners || 0;
  const committedBasePairs = (rawCase.productionUnits || [])
    .filter((u: any) => !u.refinementRequestId && u.status !== 'CANCELLED' && u.status !== 'SCRAPPED')
    .reduce((sum: number, u: any) => sum + (u.quantityPairs || 0), 0);

  const hasSecondBatchOrder = (rawCase.serviceOrders || []).some(
    (so: any) => so.type === 'SECOND_BATCH' && so.status !== 'CANCELLED'
  );

  let secondBatchRadar = null;
  if (prereq.ok && committedBasePairs > 0 && totalContractedPairs > committedBasePairs) {
    const startRef =
      rawCase.shipments?.[0]?.deliveredAt ||
      rawCase.shipments?.[0]?.shippedAt ||
      rawCase.approvedAt ||
      rawCase.createdAt;
    const estimatedCurrentBatchEnd = estimateBatchEndDate(
      new Date(startRef),
      committedBasePairs
    );
    const prepDueAt = calculateSecondBatchPrepDueAt(estimatedCurrentBatchEnd, 30);

    secondBatchRadar = {
      eligible: !hasSecondBatchOrder,
      alreadyRequested: hasSecondBatchOrder,
      currentBatchRange: `1–${committedBasePairs}`,
      nextRangeStart: committedBasePairs + 1,
      nextRangeEnd: totalContractedPairs,
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
    chiefComplaint: canSeeClinicalDetails ? rawCase.chiefComplaint : null,
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

    additionalOrderGate: {
      allowed: prereq.ok,
      code: prereq.code || null,
      reason: prereq.error || null,
    },

    commercialGateSummary: {
      hasInitialApprovedSetup,
      isContractConfirmed,
      doubleTriggerSatisfied: hasInitialApprovedSetup && isContractConfirmed,
    },

    deliveriesSummary: buildDeliveriesSummary(rawCase),

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
      contractVersionUsed: caps.canReadContract ? r.contractVersionUsed : undefined,
      clinicalReason: canSeeClinicalDetails ? r.clinicalReason : null,
      clinicalStatus: r.clinicalStatus,
      isCoveredByContract: caps.canReadContract ? r.isCoveredByContract : undefined,
      extraAlignersCount: r.extraAlignersCount,
      extraAmountChargedCents: caps.canReadContract ? r.extraAmountChargedCents : undefined,
      commercialStatus: caps.canReadContract ? r.commercialStatus : undefined,
      commerciallyApprovedBy: caps.canReadContract ? r.commerciallyApprovedBy || null : undefined,
      commerciallyApprovedAt: caps.canReadContract ? r.commerciallyApprovedAt || null : undefined,
      requestedBy: r.requestedBy,
      createdAt: r.createdAt,
    })),

    commercialContract: caps.canReadContract
      ? buildCommercialContractPayload(contract, rawCase.refinementRequests || [])
      : null,

    operationalEvents: (rawCase.operationalEvents || []).filter((ev: any) => {
      if (isClinicViewer && ev.isInternalOnly) return false;
      if (!canSeeCommercialTimeline && isCommercialEventType(ev.eventType)) return false;
      return true;
    }),

    externalLinks: (rawCase.externalLinks || []).filter((link: any) => {
      if (link.provider === 'NEMO' && isClinicViewer) return false;
      if (link.provider === 'ERP_FINANCIAL' && !caps.canReadContract) return false;
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
  const isClinicViewer = user.organizationType === 'CLINIC';

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
      externalLinks: patient.externalLinks.filter(
        (l) => !(isClinicViewer && l.provider === 'NEMO')
      ),
      createdAt: patient.createdAt,
      piiMinimized: false,
      commercialOnly: false,
    },
    treatments: capabilities.canReadCase
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
  const isClinicViewer = user.organizationType === 'CLINIC';
  const isCommercialOnly = !capabilities.canReadCase && capabilities.canReadContract;

  if (isCommercialOnly) {
    return {
      viewMode: 'COMMERCIAL_ONLY' as const,
      capabilities,
      patient: {
        id: null,
        patientCode: formatPatientCode(p.id),
        fullName: null,
        birthDate: null,
        gender: null,
        phone: null,
        email: null,
        tcleSigned: null,
        clinic: p.clinic,
        externalLinks: [],
        createdAt: null,
        piiMinimized: true,
        commercialOnly: true,
      },
      treatments: [serializeTreatmentCommercialOnly(rawCase, user)],
    };
  }

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
        externalLinks: p.externalLinks.filter(
          (l) => !(isClinicViewer && l.provider === 'NEMO')
        ),
        createdAt: p.createdAt,
        piiMinimized: false,
        commercialOnly: false,
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
        commercialOnly: false,
      };

  return {
    viewMode: 'TREATMENT_360' as const,
    capabilities,
    patient: patientHeader,
    treatments: [serializeTreatmentForUser(rawCase, user)],
  };
}
