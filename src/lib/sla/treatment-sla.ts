/**
 * FyAlign B2B — Motor Oficial de Prazos Operacionais (SLA Engine) & Cronograma de Levas
 *
 * Regras de Negócio da Matriz FyAlign v2.0:
 * 1. Pedido Inicial / Refinamento — Prazo de envio do Setup:
 *      setupDueAt = receivedAt + N dias úteis (padrão: 3 dias úteis)
 * 2. Produção — Prazo para alinhadores ficarem prontos após aprovação:
 *      productionDueAt = approvedAt + N dias (configurável por contrato/plano:
 *      padrão inicial 15 dias, suportando CALENDAR_DAYS ou BUSINESS_DAYS)
 * 3. Segunda Leva — Gatilho operacional programado:
 *      nextBatchPrepDueAt = batchEndEstimateAt - 30 dias (1 mês antes dos últimos pares)
 */

export const SLA_DAY_TYPE = {
  CALENDAR_DAYS: 'CALENDAR_DAYS',
  BUSINESS_DAYS: 'BUSINESS_DAYS',
} as const;

export type SlaDayType = (typeof SLA_DAY_TYPE)[keyof typeof SLA_DAY_TYPE];

export const DEFAULT_SETUP_SLA_BUSINESS_DAYS = 3;
export const DEFAULT_PRODUCTION_SLA_DAYS = 15;
export const DEFAULT_PRODUCTION_SLA_DAY_TYPE: SlaDayType = SLA_DAY_TYPE.CALENDAR_DAYS;
export const DEFAULT_SECOND_BATCH_LEAD_DAYS = 30;
export const DEFAULT_DAYS_PER_ALIGNER_PAIR = 15; // 12 pares ≈ 180 dias (6 meses)

export interface ProductionSlaConfig {
  days?: number | null;
  dayType?: SlaDayType | string | null;
}

export type SlaHealthState =
  | 'NOT_APPLICABLE'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE'
  | 'ON_TRACK'
  | 'DUE_SOON'
  | 'OVERDUE';

export interface SlaEvaluation {
  dueAt: string | null;
  completedAt: string | null;
  state: SlaHealthState;
  remainingDays: number | null;
  label: string;
}

/**
 * Verifica se uma data cai em dia útil (Segunda a Sexta, em UTC/local consistente),
 * permitindo opcionalmente lista de feriados ISO ('YYYY-MM-DD').
 */
export function isBusinessDay(date: Date, holidayIsoDates: readonly string[] = []): boolean {
  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  if (holidayIsoDates.length > 0) {
    const iso = date.toISOString().slice(0, 10);
    if (holidayIsoDates.includes(iso)) {
      return false;
    }
  }
  return true;
}

/**
 * Soma N dias úteis a uma data base (preservando o horário de referência).
 */
export function addBusinessDays(
  baseDate: Date,
  businessDays: number,
  holidayIsoDates: readonly string[] = []
): Date {
  const result = new Date(baseDate.getTime());
  if (businessDays <= 0) {
    return result;
  }

  let added = 0;
  while (added < businessDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result, holidayIsoDates)) {
      added += 1;
    }
  }
  return result;
}

/**
 * Soma (ou subtrai, se negativo) N dias corridos a uma data base.
 */
export function addCalendarDays(baseDate: Date, calendarDays: number): Date {
  const result = new Date(baseDate.getTime());
  result.setUTCDate(result.getUTCDate() + calendarDays);
  return result;
}

/**
 * Regra 1: Até 3 dias úteis (ou override contratual) para enviar o Setup após recebimento da OS.
 */
export function calculateSetupDueAt(
  receivedAt: Date,
  setupSlaBusinessDays: number = DEFAULT_SETUP_SLA_BUSINESS_DAYS,
  holidayIsoDates: readonly string[] = []
): Date {
  const days =
    Number.isFinite(setupSlaBusinessDays) && setupSlaBusinessDays > 0
      ? Math.floor(setupSlaBusinessDays)
      : DEFAULT_SETUP_SLA_BUSINESS_DAYS;
  return addBusinessDays(receivedAt, days, holidayIsoDates);
}

/**
 * Regra 2: Prazo para os alinhadores ficarem prontos após aprovação
 * (Pedido Inicial: após aprovação de setup + orçamento; Refinamento coberto: após aprovação de setup).
 * Configurável por contrato/plano (dias corridos ou dias úteis).
 */
export function calculateProductionDueAt(
  approvedAt: Date,
  config?: ProductionSlaConfig,
  holidayIsoDates: readonly string[] = []
): Date {
  const days =
    config?.days && Number.isFinite(config.days) && config.days > 0
      ? Math.floor(config.days)
      : DEFAULT_PRODUCTION_SLA_DAYS;

  const dayType: SlaDayType =
    config?.dayType === SLA_DAY_TYPE.BUSINESS_DAYS
      ? SLA_DAY_TYPE.BUSINESS_DAYS
      : DEFAULT_PRODUCTION_SLA_DAY_TYPE;

  if (dayType === SLA_DAY_TYPE.BUSINESS_DAYS) {
    return addBusinessDays(approvedAt, days, holidayIsoDates);
  }
  return addCalendarDays(approvedAt, days);
}

/**
 * Estima o término de uso clínico da leva atual (ex: 12 pares * 15 dias = 180 dias / 6 meses).
 */
export function estimateBatchEndDate(
  batchStartDate: Date,
  alignerPairsCount: number,
  daysPerPair: number = DEFAULT_DAYS_PER_ALIGNER_PAIR
): Date {
  const safePairs = Math.max(1, Math.floor(alignerPairsCount));
  const safeDaysPerPair = Math.max(1, Math.floor(daysPerPair));
  return addCalendarDays(batchStartDate, safePairs * safeDaysPerPair);
}

/**
 * Regra 3: Gatilho da Segunda Leva — preparação interna iniciada 1 mês (30 dias) antes do término da leva anterior.
 */
export function calculateSecondBatchPrepDueAt(
  batchEndEstimateAt: Date,
  leadDays: number = DEFAULT_SECOND_BATCH_LEAD_DAYS
): Date {
  const safeLead = Math.max(1, Math.floor(leadDays));
  return addCalendarDays(batchEndEstimateAt, -safeLead);
}

/**
 * Avalia a saúde de qualquer prazo operacional (Setup, Produção ou Gatilho de 2ª Leva).
 */
export function evaluateSlaStatus(
  dueAt: Date | null | undefined,
  completedAt?: Date | null,
  referenceNow: Date = new Date()
): SlaEvaluation {
  if (!dueAt) {
    return {
      dueAt: null,
      completedAt: completedAt ? completedAt.toISOString() : null,
      state: 'NOT_APPLICABLE',
      remainingDays: null,
      label: 'Aguardando gatilho',
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;

  if (completedAt) {
    const onTime = completedAt.getTime() <= dueAt.getTime();
    return {
      dueAt: dueAt.toISOString(),
      completedAt: completedAt.toISOString(),
      state: onTime ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE',
      remainingDays: 0,
      label: onTime ? 'Concluído no prazo' : 'Concluído fora do prazo',
    };
  }

  const diffMs = dueAt.getTime() - referenceNow.getTime();
  const remainingDays = Math.ceil(diffMs / msPerDay);

  if (diffMs < 0) {
    return {
      dueAt: dueAt.toISOString(),
      completedAt: null,
      state: 'OVERDUE',
      remainingDays,
      label: `Atrasado (${Math.abs(remainingDays)}d)`,
    };
  }

  if (remainingDays <= 2) {
    return {
      dueAt: dueAt.toISOString(),
      completedAt: null,
      state: 'DUE_SOON',
      remainingDays,
      label: remainingDays === 0 ? 'Vence hoje' : `Vence em ${remainingDays}d`,
    };
  }

  return {
    dueAt: dueAt.toISOString(),
    completedAt: null,
    state: 'ON_TRACK',
    remainingDays,
    label: `No prazo (${remainingDays}d restantes)`,
  };
}

/**
 * Gera um identificador legível e único de Ordem de Serviço (ex: OS-2026-48219).
 */
export function buildServiceOrderNumber(sequenceHint: number = 1, now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OS-${year}-${String(sequenceHint).padStart(2, '0')}${rand}`;
}

