import { z } from 'zod';

export const PRODUCTION_UNIT_TYPE = {
  SINGLE_PAIR: 'SINGLE_PAIR',
  BATCH: 'BATCH',
} as const;

export type ProductionUnitType = (typeof PRODUCTION_UNIT_TYPE)[keyof typeof PRODUCTION_UNIT_TYPE];

export const PRODUCTION_UNIT_STATUS = {
  PENDING: 'PENDING',
  IN_PRODUCTION: 'IN_PRODUCTION',
  QC_INSPECTION: 'QC_INSPECTION',
  QC_PASSED: 'QC_PASSED',
  QC_REJECTED: 'QC_REJECTED',
  SHIPPED: 'SHIPPED',
} as const;

export type ProductionUnitStatus = (typeof PRODUCTION_UNIT_STATUS)[keyof typeof PRODUCTION_UNIT_STATUS];

export const SHIPMENT_STATUS = {
  PREPARING: 'PREPARING',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
} as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[keyof typeof SHIPMENT_STATUS];

export const CreateProductionUnitSchema = z.object({
  unitCode: z.string().min(2, 'Código identificador da unidade/lote obrigatório'),
  type: z.nativeEnum(PRODUCTION_UNIT_TYPE).default('BATCH'),
  quantityPairs: z.number().int().positive('Quantidade de pares deve ser maior que zero'),
  stagesDescription: z.string().min(3, 'Descrição dos estágios contemplados obrigatória (ex: "Estágios 01 a 06")'),
  plannedStartDate: z.string().datetime().optional().nullable(),
  plannedEndDate: z.string().datetime().optional().nullable(),
  refinementRequestId: z.string().uuid().optional().nullable(),
});

export type CreateProductionUnitInput = z.infer<typeof CreateProductionUnitSchema>;

export const QcInspectionSchema = z.object({
  approved: z.boolean(),
  laserMarkingVerified: z.boolean(),
  edgeLaserCutVerified: z.boolean(),
  opticalClarityVerified: z.boolean(),
  noBubblesOrDefects: z.boolean(),
  alignersQuantityVerified: z.boolean(),
  qcNotes: z.string().optional().nullable(),
});

export type QcInspectionInput = z.infer<typeof QcInspectionSchema>;

export const ShipmentItemInputSchema = z.object({
  productionUnitId: z.string().uuid('ID da unidade de produção inválido'),
  quantityShipped: z.number().int().positive('Quantidade a expedir deve ser maior que zero'),
});

export const CreateShipmentSchema = z.object({
  carrierName: z.string().min(2, 'Nome da transportadora obrigatório'),
  trackingCode: z.string().min(3, 'Código de rastreamento obrigatório'),
  plannedDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(ShipmentItemInputSchema).min(1, 'A remessa deve conter pelo menos uma unidade/lote de produção'),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;

export const CreateRefinementSchema = z.object({
  clinicalReason: z.string().min(5, 'Motivo clínico do refinamento é obrigatório (mínimo 5 caracteres)'),
  extraAlignersCount: z.number().int().positive('Quantidade estimada de alinhadores adicionais obrigatória'),
});

export type CreateRefinementInput = z.infer<typeof CreateRefinementSchema>;

export const CommercialApproveRefinementSchema = z.object({
  approved: z.boolean(),
  isCoveredByContract: z.boolean(),
  extraAmountChargedCents: z.number().int().nonnegative().default(0),
  commercialNotes: z.string().optional().nullable(),
});

export type CommercialApproveRefinementInput = z.infer<typeof CommercialApproveRefinementSchema>;
