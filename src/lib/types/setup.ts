import { z } from 'zod';

/**
 * Movimentação dentária calculada no software CAD ortodôntico
 */
export const ToothMovementSchema = z.object({
  toothFdi: z.string().regex(/^[1-4][1-8]$/, 'Notação FDI inválida (deve ser entre 11 e 48)'),
  translationMm: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  rotationDeg: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
});
export type ToothMovement = z.infer<typeof ToothMovementSchema>;

/**
 * Dados de um estágio individual do tratamento
 * No backend / banco: guarda apenas referências/storageKeys para evitar URLs temporárias expiradas
 */
export const SetupStageDataSchema = z.object({
  stageNumber: z.number().int().min(0),
  upperStorageKey: z.string().optional(),
  lowerStorageKey: z.string().optional(),
  movements: z.array(ToothMovementSchema).optional(),
});
export type SetupStageData = z.infer<typeof SetupStageDataSchema>;

/**
 * Representação do estágio resolvida para o Frontend / DentalViewer3D
 * Contém as URLs temporárias de download prontas para o Three.js STLLoader
 */
export const SetupStageClientSchema = z.object({
  stageNumber: z.number().int().min(0),
  upperModelUrl: z.string().optional(),
  lowerModelUrl: z.string().optional(),
  upperTriangleCount: z.number().optional(),
  lowerTriangleCount: z.number().optional(),
  movements: z.array(ToothMovementSchema).optional(),
});
export type SetupStageClient = z.infer<typeof SetupStageClientSchema>;

/**
 * Item de Desgaste Interproximal (IPR) agendado
 */
export const IPRItemSchema = z.object({
  teeth: z.string(), // Ex: "11-21"
  amountMm: z.number().positive().max(1.0),
  stage: z.number().int().min(0),
});
export type IPRItem = z.infer<typeof IPRItemSchema>;

/**
 * Item de Attachment ortodôntico de resina
 */
export const AttachmentItemSchema = z.object({
  toothFdi: z.string().regex(/^[1-4][1-8]$/, 'Notação FDI inválida (11 a 48)'),
  type: z.string(), // "Retangular Horizontal", "Biselado Oclusal", etc.
  stage: z.number().int().min(0),
});
export type AttachmentItem = z.infer<typeof AttachmentItemSchema>;

/**
 * Contrato Canônico do Setup Clínico (SetupContract)
 */
export const ClinicalSetupSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'REJECTED', 'APPROVED']),
  upperAlignersCount: z.number().int().min(0),
  lowerAlignersCount: z.number().int().min(0),
  stages: z.array(SetupStageDataSchema),
  iprSchedule: z.array(IPRItemSchema),
  attachmentSchedule: z.array(AttachmentItemSchema),
  plannerNotes: z.string().optional(),
  createdAt: z.string(),
});
export type ClinicalSetup = z.infer<typeof ClinicalSetupSchema>;

/**
 * Contrato DTO enviado para a tela do visualizador (DentalViewer3D)
 */
export const ClinicalSetupClientDtoSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  versionNumber: z.number().int().positive(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'REJECTED', 'APPROVED']),
  upperAlignersCount: z.number().int().min(0),
  lowerAlignersCount: z.number().int().min(0),
  stages: z.array(SetupStageClientSchema),
  iprSchedule: z.array(IPRItemSchema),
  attachmentSchedule: z.array(AttachmentItemSchema),
  plannerNotes: z.string().optional(),
  createdAt: z.string(),
});
export type ClinicalSetupClientDto = z.infer<typeof ClinicalSetupClientDtoSchema>;
