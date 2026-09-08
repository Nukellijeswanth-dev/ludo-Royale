/**
 * Server-side Rate Limiter for Ludo Royale
 * Protects against action flooding, chat spam, and socket abuse.
 * Provides sliding-window tracking with memory-safe periodic cleanup.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  minIntervalMs?: number;
}

class SlidingWindowLimiter {
  private limits = new Map<string, number[]>(); // key -> timestamps[]
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  public check(key: string): { allowed: boolean; retryAfterMs?: number; reason?: string } {
    const now = Date.now();
    const timestamps = this.limits.get(key) || [];

    // Filter out expired timestamps
    const active = timestamps.filter((t) => now - t < this.config.windowMs);

    // Check minimum interval between requests (burst protection)
    if (this.config.minIntervalMs && active.length > 0) {
      const last = active[active.length - 1];
      const diff = now - last;
      if (diff < this.config.minIntervalMs) {
        return {
          allowed: false,
          retryAfterMs: this.config.minIntervalMs - diff,
          reason: 'Action submitted too quickly. Please slow down.',
        };
      }
    }

    // Check window capacity
    if (active.length >= this.config.maxRequests) {
      const oldestInWindow = active[0];
      const resetTime = oldestInWindow + this.config.windowMs - now;
      return {
        allowed: false,
        retryAfterMs: Math.max(100, resetTime),
        reason: 'Rate limit exceeded. Please wait a moment.',
      };
    }

    // Allowed: record timestamp
    active.push(now);
    this.limits.set(key, active);
    return { allowed: true };
  }

  public reset(key: string): void {
    this.limits.delete(key);
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.limits.entries()) {
      const active = timestamps.filter((t) => now - t < this.config.windowMs);
      if (active.length === 0) {
        this.limits.delete(key);
      } else {
        this.limits.set(key, active);
      }
    }
  }

  public size(): number {
    return this.limits.size;
  }
}

export class RateLimiterManager {
  // Gameplay actions: max 4 rolls/moves per 1 second, min 150ms between clicks
  public readonly actions = new SlidingWindowLimiter({
    maxRequests: 4,
    windowMs: 1000,
    minIntervalMs: 150,
  });

  // Chat messages: max 4 messages per 3 seconds, min 250ms gap
  public readonly chat = new SlidingWindowLimiter({
    maxRequests: 4,
    windowMs: 3000,
    minIntervalMs: 250,
  });

  // Reactions: max 3 emoji reactions per 2 seconds, min 300ms gap
  public readonly reactions = new SlidingWindowLimiter({
    maxRequests: 3,
    windowMs: 2000,
    minIntervalMs: 300,
  });

  // Room operations (create/join/ready): max 10 per 10 seconds
  public readonly roomOps = new SlidingWindowLimiter({
    maxRequests: 10,
    windowMs: 10000,
    minIntervalMs: 200,
  });

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Memory safety: Sweep inactive keys every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.actions.cleanup();
      this.chat.cleanup();
      this.reactions.cleanup();
      this.roomOps.cleanup();
    }, 60000);
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const rateLimiter = new RateLimiterManager();
