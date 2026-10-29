/**
 * FyAlign B2B - Módulo de Rate Limiting em Memória (F6.06)
 * Prevenção de ataques de força bruta, abuso de uploads e DoS.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  totalLimit: number;
  resetSeconds: number;
}

/**
 * Valida se uma chave (geralmente IP ou IP + Rota) excedeu a taxa limite.
 * 
 * @param key Identificador único (ex: "auth:192.168.1.1" ou "api:case-upload:192.168.1.1")
 * @param maxRequests Limite máximo de requisições no intervalo
 * @param windowSeconds Janela temporal em segundos
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const threshold = now - windowMs;

  let record = memoryStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(key, record);
  }

  // Filtrar timestamps que ainda estão dentro da janela de tempo atual
  record.timestamps = record.timestamps.filter((ts) => ts > threshold);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      totalLimit: maxRequests,
      resetSeconds,
    };
  }

  record.timestamps.push(now);
  const remaining = maxRequests - record.timestamps.length;

  return {
    allowed: true,
    remaining,
    totalLimit: maxRequests,
    resetSeconds: windowSeconds,
  };
}

/**
 * Limpa o histórico de rate limit para uma chave específica (ex: após login bem-sucedido ou em testes).
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}

/**
 * Limpa todo o armazenamento de rate limiting.
 */
export function clearAllRateLimits(): void {
  memoryStore.clear();
}
