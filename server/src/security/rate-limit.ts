/**
 * Rate Limiter nativo leve baseado em Sliding Window / Token Bucket in-memory.
 * Protege endpoints sensíveis (ex: /api/auth/* e /api/skills/custom/execute) contra abuso e força bruta.
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxTokens = 60, windowMs = 60000) {
    this.maxTokens = maxTokens;
    this.refillIntervalMs = windowMs;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, windowMs * 2);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  public get max(): number {
    return this.maxTokens;
  }

  public get window(): number {
    return this.refillIntervalMs;
  }

  public consume(key: string, cost = 1): { allowed: boolean; remaining: number; retryAfterSec?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      // Reabastece tokens proporcionalmente ao tempo decorrido
      const elapsed = now - bucket.lastRefill;
      if (elapsed >= this.refillIntervalMs) {
        bucket.tokens = this.maxTokens;
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: bucket.tokens };
    }

    const retryAfterSec = Math.ceil((bucket.lastRefill + this.refillIntervalMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: retryAfterSec > 0 ? retryAfterSec : 1,
    };
  }

  public reset(): void {
    this.buckets.clear();
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.refillIntervalMs * 2) {
        this.buckets.delete(key);
      }
    }
  }
}

// Instâncias pré-configuradas para diferentes sensibilidades
export const authRateLimiter = new RateLimiter(30, 60000); // 30 req/min para rotas de auth
export const toolExecRateLimiter = new RateLimiter(45, 60000); // 45 req/min para execução de ferramentas
export const aiRateLimiter = new RateLimiter(60, 60000); // 60 req/min para rotas de IA
export const ragRateLimiter = new RateLimiter(60, 60000); // 60 req/min para buscas semânticas (RAG)
export const gitHeavyOpsRateLimiter = new RateLimiter(20, 60000); // 20 req/min para operações pesadas Git
export const aiStreamRateLimiter = new RateLimiter(30, 60000); // 30 req/min para streaming SSE de IA
