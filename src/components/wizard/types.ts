import {
  MidlinePosition,
  OcclusionClass,
  TreatmentAction,
  ElasticOption,
  CorrectionOption,
  DiastemaOption,
  CaseFileType,
} from '@/lib/types/clinical';

export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WizardStepMeta {
  number: WizardStepNumber;
  title: string;
  shortTitle: string;
  description: string;
}

export interface ProfessionalInfo {
  userId: string;
  fullName: string;
  email: string;
  cro: string;
  clinicId: string;
  clinicName: string;
  role: string;
  croStatus: string;
}

export interface PatientFormData {
  id?: string;
  isNew: boolean;
  fullName: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | '';
  phone: string;
  email: string;
  patientCode?: string;
  clinicName?: string;
}

export interface ClinicalConditionFormData {
  upperMidline: MidlinePosition | '';
  lowerMidline: MidlinePosition | '';
  canineRight: OcclusionClass | '';
  canineLeft: OcclusionClass | '';
  molarRight: OcclusionClass | '';
  molarLeft: OcclusionClass | '';
}

export interface TreatmentPlanFormData {
  upperMidline: TreatmentAction;
  lowerMidline: TreatmentAction;
  overjet: TreatmentAction;
  overbite: TreatmentAction;
  archForm: TreatmentAction;
  expansion: TreatmentAction;
  canineRelationship: TreatmentAction;
  molarRelationship: TreatmentAction;

  ipr: boolean;
  attachment: boolean;
  intermaxillaryElastic: ElasticOption;

  classIICorrection: CorrectionOption;
  classIIICorrection: CorrectionOption;

  smartAttachments: string;
  diastemas: DiastemaOption;
  additionalInstructions: string;
}

export interface FileSlotInfo {
  slotNumber: number;
  title: string;
  category: string;
  type: CaseFileType;
  description: string;
  allowedExtensions: string[];
  maxSizeBytes: number;
  required: boolean;
  status: 'EMPTY' | 'UPLOADING' | 'UPLOADED' | 'ERROR';
  originalFileName?: string;
  fileSizeBytes?: number;
  progressPercent?: number;
  errorMessage?: string;
  fileId?: string;
  previewUrl?: string;
}

export interface ConsentFormData {
  policyVersion: string;
  policyHash: string;
  agreed: boolean;
  signatureBase64?: string;
  signedAt?: string;
}

export interface WizardDraftState {
  caseId: string | null;
  caseCode: string | null;
  status: string;
  step: WizardStepNumber;
  professional: ProfessionalInfo | null;
  patient: PatientFormData;
  condition: ClinicalConditionFormData;
  treatmentPlan: TreatmentPlanFormData;
  files: Record<number, FileSlotInfo>;
  consent: ConsentFormData;
  isSaving: boolean;
  lastSavedAt: Date | null;
  errorMessage: string | null;
}
