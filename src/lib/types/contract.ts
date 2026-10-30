import { z } from 'zod';

export const CONTRACT_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  AMENDED: 'AMENDED',
  CANCELLED: 'CANCELLED',
} as const;

export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

export const PRODUCTION_MODEL = {
  ALL_AT_ONCE: 'ALL_AT_ONCE',
  PHASED_BATCHES: 'PHASED_BATCHES',
  HYBRID: 'HYBRID',
} as const;

export type ProductionModel = (typeof PRODUCTION_MODEL)[keyof typeof PRODUCTION_MODEL];

export const DELIVERY_MODEL = {
  SINGLE_SHIPMENT: 'SINGLE_SHIPMENT',
  BATCHED: 'BATCHED',
} as const;

export type DeliveryModel = (typeof DELIVERY_MODEL)[keyof typeof DELIVERY_MODEL];

export const CONTRACT_SLA_DAY_TYPE = {
  CALENDAR_DAYS: 'CALENDAR_DAYS',
  BUSINESS_DAYS: 'BUSINESS_DAYS',
} as const;

export type ContractSlaDayType =
  (typeof CONTRACT_SLA_DAY_TYPE)[keyof typeof CONTRACT_SLA_DAY_TYPE];

export const CreateContractSchema = z.object({
  packageName: z.string().min(2, 'Nome do pacote obrigatório'),
  contractedAligners: z.number().int().positive('Quantidade de pares deve ser maior que zero'),
  totalPriceCents: z.number().int().nonnegative('Preço deve ser em centavos inteiros (>= 0)'),
  currency: z.string().default('BRL'),
  productionModel: z.nativeEnum(PRODUCTION_MODEL).default('HYBRID'),
  deliveryModel: z.nativeEnum(DELIVERY_MODEL).default('BATCHED'),
  includedRefinements: z.number().int().min(0).default(0),
  refinementWindowDays: z.number().int().positive().default(180),
  extraAlignerPriceCents: z.number().int().nonnegative().default(0),
  setupSlaBusinessDays: z.number().int().positive().default(3),
  productionSlaDays: z.number().int().positive().default(15),
  productionSlaDayType: z.nativeEnum(CONTRACT_SLA_DAY_TYPE).default('CALENDAR_DAYS'),
  commercialNotes: z.string().optional().nullable(),
});

export type CreateContractInput = z.infer<typeof CreateContractSchema>;

export const AmendContractSchema = z.object({
  changeReason: z.string().min(5, 'Justificativa da alteração é obrigatória (mínimo 5 caracteres)'),
  contractedAligners: z.number().int().positive().optional(),
  totalPriceCents: z.number().int().nonnegative().optional(),
  productionModel: z.nativeEnum(PRODUCTION_MODEL).optional(),
  deliveryModel: z.nativeEnum(DELIVERY_MODEL).optional(),
  includedRefinements: z.number().int().min(0).optional(),
  refinementWindowDays: z.number().int().positive().optional(),
  extraAlignerPriceCents: z.number().int().nonnegative().optional(),
  setupSlaBusinessDays: z.number().int().positive().optional(),
  productionSlaDays: z.number().int().positive().optional(),
  productionSlaDayType: z.nativeEnum(CONTRACT_SLA_DAY_TYPE).optional(),
  commercialNotes: z.string().optional().nullable(),
});

export type AmendContractInput = z.infer<typeof AmendContractSchema>;

export const UpdateScheduleSchema = z.object({
  unitId: z.string().uuid('ID da unidade de produção inválido'),
  changeReason: z.string().min(5, 'Motivo da alteração de cronograma obrigatório'),
  plannedStartDate: z.string().datetime().optional().nullable(),
  plannedEndDate: z.string().datetime().optional().nullable(),
});

export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;
