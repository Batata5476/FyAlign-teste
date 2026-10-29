import { z } from 'zod';

// ============================================================================
// 1. ENUMS E CONSTANTES DA CONDIÇÃO CLÍNICA EXISTENTE (ClinicalCondition)
// ============================================================================

export const MIDLINE_POSITION = {
  CENTERED: 'CENTERED',
  DEVIATED_RIGHT: 'DEVIATED_RIGHT',
  DEVIATED_LEFT: 'DEVIATED_LEFT',
} as const;

export type MidlinePosition = (typeof MIDLINE_POSITION)[keyof typeof MIDLINE_POSITION];

export const OCCLUSION_CLASS = {
  CLASS_I: 'CLASS_I',
  CLASS_II: 'CLASS_II',
  CLASS_III: 'CLASS_III',
} as const;

export type OcclusionClass = (typeof OCCLUSION_CLASS)[keyof typeof OCCLUSION_CLASS];

// ============================================================================
// 2. ENUMS E CONSTANTES DO PLANO DE TRATAMENTO (TreatmentPlan)
// ============================================================================

export const TREATMENT_ACTION = {
  MAINTAIN: 'MAINTAIN',
  IMPROVE: 'IMPROVE',
} as const;

export type TreatmentAction = (typeof TREATMENT_ACTION)[keyof typeof TREATMENT_ACTION];

export const ELASTIC_OPTION = {
  NO: 'NO',
  IF_NECESSARY: 'IF_NECESSARY',
  YES: 'YES',
} as const;

export type ElasticOption = (typeof ELASTIC_OPTION)[keyof typeof ELASTIC_OPTION];

export const CORRECTION_OPTION = {
  CORRECT: 'CORRECT',
  DO_NOT_CORRECT: 'DO_NOT_CORRECT',
} as const;

export type CorrectionOption = (typeof CORRECTION_OPTION)[keyof typeof CORRECTION_OPTION];

export const DIASTEMA_OPTION = {
  NONE: 'NONE',
  CLOSE_ALL: 'CLOSE_ALL',
  CLOSE_SELECTED: 'CLOSE_SELECTED',
} as const;

export type DiastemaOption = (typeof DIASTEMA_OPTION)[keyof typeof DIASTEMA_OPTION];

// ============================================================================
// 3. ENUMS E MAPEAMENTO DE TIPOS DE ARQUIVO (CaseFileType por Slot 1 a 13)
// ============================================================================

export const CASE_FILE_TYPES = {
  // Fotos Extraorais
  PHOTO_FRONTAL_REST: 'PHOTO_FRONTAL_REST',   // Slot 1
  PHOTO_PROFILE_RIGHT: 'PHOTO_PROFILE_RIGHT', // Slot 2
  PHOTO_FRONTAL_SMILE: 'PHOTO_FRONTAL_SMILE', // Slot 3

  // Fotos Intraorais
  PHOTO_INTRA_RIGHT: 'PHOTO_INTRA_RIGHT',     // Slot 4
  PHOTO_INTRA_FRONTAL: 'PHOTO_INTRA_FRONTAL', // Slot 5
  PHOTO_INTRA_LEFT: 'PHOTO_INTRA_LEFT',       // Slot 6
  PHOTO_INTRA_UPPER: 'PHOTO_INTRA_UPPER',     // Slot 7
  PHOTO_INTRA_LOWER: 'PHOTO_INTRA_LOWER',     // Slot 8

  // Radiografias
  XRAY_PANORAMIC: 'XRAY_PANORAMIC',           // Slot 9
  XRAY_CEPHALOMETRIC: 'XRAY_CEPHALOMETRIC',   // Slot 10

  // Escaneamentos 3D
  STL_MAXILLA: 'STL_MAXILLA',                 // Slot 11
  STL_MANDIBLE: 'STL_MANDIBLE',               // Slot 12
  STL_OCCLUSION: 'STL_OCCLUSION',             // Slot 13

  // Documentos
  TCLE_DOCUMENT: 'TCLE_DOCUMENT',             // Anexo avulso ou slot suplementar
} as const;

export type CaseFileType = (typeof CASE_FILE_TYPES)[keyof typeof CASE_FILE_TYPES];

export const SLOT_FILE_TYPE_MAP: Record<number, CaseFileType> = {
  1: CASE_FILE_TYPES.PHOTO_FRONTAL_REST,
  2: CASE_FILE_TYPES.PHOTO_PROFILE_RIGHT,
  3: CASE_FILE_TYPES.PHOTO_FRONTAL_SMILE,
  4: CASE_FILE_TYPES.PHOTO_INTRA_RIGHT,
  5: CASE_FILE_TYPES.PHOTO_INTRA_FRONTAL,
  6: CASE_FILE_TYPES.PHOTO_INTRA_LEFT,
  7: CASE_FILE_TYPES.PHOTO_INTRA_UPPER,
  8: CASE_FILE_TYPES.PHOTO_INTRA_LOWER,
  9: CASE_FILE_TYPES.XRAY_PANORAMIC,
  10: CASE_FILE_TYPES.XRAY_CEPHALOMETRIC,
  11: CASE_FILE_TYPES.STL_MAXILLA,
  12: CASE_FILE_TYPES.STL_MANDIBLE,
  13: CASE_FILE_TYPES.STL_OCCLUSION,
};

export function getCaseFileTypeBySlot(slotNumber: number): CaseFileType | undefined {
  return SLOT_FILE_TYPE_MAP[slotNumber];
}

// ============================================================================
// 4. SCHEMAS ZOD DE VALIDAÇÃO DOS NOVOS MODELOS
// ============================================================================

export const ClinicalConditionSchema = z.object({
  upperMidline: z.nativeEnum(MIDLINE_POSITION),
  lowerMidline: z.nativeEnum(MIDLINE_POSITION),
  canineRight: z.nativeEnum(OCCLUSION_CLASS),
  canineLeft: z.nativeEnum(OCCLUSION_CLASS),
  molarRight: z.nativeEnum(OCCLUSION_CLASS),
  molarLeft: z.nativeEnum(OCCLUSION_CLASS),
});

export type ClinicalConditionInput = z.infer<typeof ClinicalConditionSchema>;

export const TreatmentPlanSchema = z.object({
  upperMidline: z.nativeEnum(TREATMENT_ACTION),
  lowerMidline: z.nativeEnum(TREATMENT_ACTION),
  overjet: z.nativeEnum(TREATMENT_ACTION),
  overbite: z.nativeEnum(TREATMENT_ACTION),
  archForm: z.nativeEnum(TREATMENT_ACTION),
  expansion: z.nativeEnum(TREATMENT_ACTION),
  canineRelationship: z.nativeEnum(TREATMENT_ACTION),
  molarRelationship: z.nativeEnum(TREATMENT_ACTION),

  ipr: z.boolean().default(false),
  attachment: z.boolean().default(false),
  intermaxillaryElastic: z.nativeEnum(ELASTIC_OPTION).default('NO'),

  classIICorrection: z.nativeEnum(CORRECTION_OPTION).default('DO_NOT_CORRECT'),
  classIIICorrection: z.nativeEnum(CORRECTION_OPTION).default('DO_NOT_CORRECT'),

  smartAttachments: z.string().optional().nullable(),
  diastemas: z.nativeEnum(DIASTEMA_OPTION).default('NONE'),
  additionalInstructions: z.string().optional().nullable(),
});

export type TreatmentPlanInput = z.infer<typeof TreatmentPlanSchema>;

export const CaseConsentSchema = z.object({
  policyVersion: z.string().min(1, 'Versão da política é obrigatória'),
  policyHash: z.string().min(16, 'Hash de integridade da política é obrigatório'),
  acceptedAt: z.date().optional().default(() => new Date()),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  scrollCompleted: z.boolean().default(false),
  signatureKey: z.string().optional().nullable(),
  signatureHash: z.string().optional().nullable(),
});

export type CaseConsentInput = z.infer<typeof CaseConsentSchema>;

// ============================================================================
// 5. STATUS DO WORKFLOW E TRAVA DE IMUTABILIDADE CLÍNICA (RN-03)
// ============================================================================
// Workflow canônico:
// DRAFT → SUBMITTED → TRIAGE → PLANNING → PENDING_APPROVAL → REVISION_REQUESTED → APPROVED → IN_PRODUCTION → QC → SHIPPED → COMPLETED

export const LOCKED_CASE_STATUSES = [
  'APPROVED',
  'APPROVED_BY_DOCTOR',
  'IN_PRODUCTION',
  'QC',
  'QUALITY_CONTROL',
  'SHIPPED',
  'DISPATCHED',
  'COMPLETED',
  'DELIVERED',
] as const;

export type LockedCaseStatus = (typeof LOCKED_CASE_STATUSES)[number];

export function isCaseClinicallyLocked(status: string): boolean {
  return (LOCKED_CASE_STATUSES as readonly string[]).includes(status);
}
