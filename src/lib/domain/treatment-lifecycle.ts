/**
 * FyAlign B2B — Regras de Domínio Transacionais do Tratamento, Contratos e Solicitações (Fase B3/B4)
 *
 * Centraliza:
 * 1. Validação estrita dos 4 pré-requisitos para abertura formal de Segunda Leva e Refinamento
 * 2. Verificação de contrato ativo/confirmado (CONFIRMED | AMENDED com confirmedAt preenchido)
 * 3. Segregação semântica de eventos operacionais vs. estritamente comerciais (LGPD / RBAC)
 * 4. Controle de idempotência contra retries, cliques duplos e corridas concorrentes
 */

import { NextRequest } from 'next/server';

export const COMMERCIAL_EVENT_TYPES = new Set<string>([
  'BUDGET_SENT',
  'CLIENT_APPROVAL_RECORDED',
  'COMMERCIAL_NOTE',
  'CONTRACT_PROPOSED',
  'CONTRACT_CONFIRMED',
  'CONTRACT_AMENDED',
  'REFINEMENT_COMMERCIAL_DECISION',
]);

export function isCommercialEventType(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  return COMMERCIAL_EVENT_TYPES.has(eventType);
}

/**
 * Um contrato comercial só é considerado confirmado e vigente se:
 * - existir;
 * - possuir status CONFIRMED ou AMENDED;
 * - possuir timestamp formal de confirmação (confirmedAt != null).
 */
export function isContractActiveAndConfirmed(contract: any | null | undefined): boolean {
  if (!contract) return false;
  if (contract.status !== 'CONFIRMED' && contract.status !== 'AMENDED') return false;
  return Boolean(contract.confirmedAt);
}

/**
 * Verifica se o tratamento já possui o Setup inicial clinicamente aprovado pelo ortodontista.
 */
export function hasClinicallyApprovedInitialSetup(setups: any[] | null | undefined): boolean {
  if (!Array.isArray(setups) || setups.length === 0) return false;
  return setups.some((s) => s.status === 'APPROVED' && Boolean(s.approvedAt));
}

export interface AdditionalOrderValidationResult {
  ok: boolean;
  status?: number;
  code?: string;
  error?: string;
  contract?: any;
  approvedSetup?: any;
}

/**
 * Regra Categórica de Bloqueio (Decisão 3 da Homologação B3/B4):
 * Nenhuma OS formal de REFINEMENT ou SECOND_BATCH pode ser aberta sem TODOS os 4 pré-requisitos:
 * 1. Setup inicial clinicamente aprovado;
 * 2. Contrato comercial confirmado;
 * 3. Tratamento vinculado validamente ao contrato;
 * 4. Política contratual de refinamentos e entregas disponível (e saldo de pares na Segunda Leva).
 */
export function validateAdditionalOrderPrerequisites(
  treatment: {
    id: string;
    setups?: any[] | null;
    commercialContract?: any | null;
    productionUnits?: any[] | null;
  },
  options?: {
    orderType?: 'SECOND_BATCH' | 'REFINEMENT';
    alignerRangeStart?: number | null;
    alignerRangeEnd?: number | null;
  }
): AdditionalOrderValidationResult {
  const setups = treatment.setups || [];
  const approvedSetup = setups.find((s) => s.status === 'APPROVED' && Boolean(s.approvedAt)) || null;

  if (!approvedSetup) {
    return {
      ok: false,
      status: 409,
      code: 'PREREQUISITE_INITIAL_SETUP_NOT_APPROVED',
      error:
        'Bloqueio operacional: solicitações de Segunda Leva ou Refinamento exigem que o Setup inicial do tratamento esteja clinicamente aprovado.',
    };
  }

  const contract = treatment.commercialContract;
  if (!isContractActiveAndConfirmed(contract)) {
    return {
      ok: false,
      status: 409,
      code: 'PREREQUISITE_CONTRACT_NOT_CONFIRMED',
      error:
        'Bloqueio comercial: solicitações formais de Segunda Leva ou Refinamento exigem Contrato Comercial confirmado pelo Financeiro.',
    };
  }

  if (contract.caseId !== treatment.id) {
    return {
      ok: false,
      status: 409,
      code: 'PREREQUISITE_CONTRACT_UNLINKED',
      error: 'Bloqueio de integridade: o contrato comercial não está vinculado validamente a este tratamento.',
    };
  }

  const hasValidPolicy =
    typeof contract.includedRefinements === 'number' &&
    contract.includedRefinements >= 0 &&
    typeof contract.contractedAligners === 'number' &&
    contract.contractedAligners > 0 &&
    Boolean(contract.productionModel) &&
    Boolean(contract.deliveryModel);

  if (!hasValidPolicy) {
    return {
      ok: false,
      status: 409,
      code: 'PREREQUISITE_CONTRACT_POLICY_MISSING',
      error:
        'Bloqueio contratual: política comercial de franquia de refinamentos e modelo de entregas indisponível no contrato.',
    };
  }

  if (options?.orderType === 'SECOND_BATCH') {
    const start = options.alignerRangeStart ?? null;
    const end = options.alignerRangeEnd ?? null;

    if (start !== null && end !== null) {
      if (start < 1 || end < start) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_ALIGNER_RANGE',
          error: 'A faixa de alinhadores da Segunda Leva é inválida (o final deve ser maior ou igual ao inicial).',
        };
      }

      if (end > contract.contractedAligners) {
        return {
          ok: false,
          status: 409,
          code: 'SECOND_BATCH_EXCEEDS_CONTRACT',
          error: `A faixa solicitada (${start}–${end}) ultrapassa o teto contratado de ${contract.contractedAligners} pares no contrato vigente.`,
        };
      }
    }

    const nonRefinementUnits = (treatment.productionUnits || []).filter(
      (u) => !u.refinementRequestId && u.status !== 'CANCELLED' && u.status !== 'SCRAPPED'
    );
    const committedBasePairs = nonRefinementUnits.reduce(
      (sum, u) => sum + (u.quantityPairs || 0),
      0
    );

    if (start !== null && end !== null) {
      const requestedPairs = end - start + 1;
      if (committedBasePairs + requestedPairs > contract.contractedAligners) {
        return {
          ok: false,
          status: 409,
          code: 'SECOND_BATCH_NO_CONTRACT_BALANCE',
          error: `Saldo contratual insuficiente para Segunda Leva: ${committedBasePairs} pares já alocados em lotes anteriores de um total contratado de ${contract.contractedAligners} pares.`,
        };
      }
    }
  }

  return {
    ok: true,
    contract,
    approvedSetup,
  };
}

/**
 * Extrai chave de idempotência opcional de headers HTTP ou body JSON.
 */
export function extractIdempotencyKey(req: NextRequest, body?: any): string | null {
  const fromHeader =
    req.headers.get('Idempotency-Key') ||
    req.headers.get('idempotency-key') ||
    req.headers.get('x-idempotency-key');
  if (fromHeader && fromHeader.trim().length > 0) {
    return fromHeader.trim().slice(0, 128);
  }
  if (body && typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0) {
    return body.idempotencyKey.trim().slice(0, 128);
  }
  return null;
}

/**
 * Verifica no AuditLog se uma operação mutável com a mesma Idempotency-Key já foi processada,
 * devolvendo o payload persistido para replay determinístico sem duplicação.
 */
export async function findIdempotentAuditReplay(
  prismaOrTx: any,
  params: {
    caseId: string;
    userId: string;
    action: string;
    idempotencyKey: string | null;
  }
): Promise<any | null> {
  if (!params.idempotencyKey) return null;

  const recentLogs = await prismaOrTx.auditLog.findMany({
    where: {
      caseId: params.caseId,
      userId: params.userId,
      action: params.action,
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  for (const log of recentLogs) {
    if (!log.payloadDiff) continue;
    try {
      const parsed = JSON.parse(log.payloadDiff);
      if (parsed && parsed.idempotencyKey === params.idempotencyKey) {
        return parsed;
      }
    } catch {
      // ignora payload legado não-JSON
    }
  }

  return null;
}

