// apps/desktop/src/main/opencode/fallback/retry-manager.ts

/**
 * @file retry-manager.ts
 * @description Manages rate limit retries with exponential backoff and jitter
 *
 * @context Fallback system - retries before falling back to another model
 *
 * @dependencies
 * - events (EventEmitter)
 * - ./types.ts (RetryManagerConfig, RetryManagerEvents)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/adapter.ts (integrates retry before fallback)
 * - apps/desktop/src/main/opencode/fallback/fallback-engine.ts (used alongside)
 * - apps/desktop/src/main/opencode/fallback/rate-limit-detector.ts (detects rate limits)
 *
 * @usedBy
 * - OpenCodeAdapter (adapter.ts)
 *
 * AIDEV-WARNING: Delays are in milliseconds - do not confuse with seconds
 * AIDEV-NOTE: Create one instance per task, call reset() between phases
 */

import { EventEmitter } from 'events';
import type { RetryManagerConfig, RetryManagerEvents } from './types';

/**
 * Typed event emitter interface for RateLimitRetryManager
 *
 * AIDEV-NOTE: Mirrors the pattern from FallbackEngine
 */
interface TypedRetryEmitter {
  on<K extends keyof RetryManagerEvents>(
    event: K,
    listener: (data: RetryManagerEvents[K]) => void
  ): this;
  emit<K extends keyof RetryManagerEvents>(
    event: K,
    data: RetryManagerEvents[K]
  ): boolean;
  off<K extends keyof RetryManagerEvents>(
    event: K,
    listener: (data: RetryManagerEvents[K]) => void
  ): this;
  removeAllListeners(event?: keyof RetryManagerEvents): this;
}

/** Default retry configuration: 3 retries at 30s, 60s, 120s with 10% jitter */
const DEFAULT_CONFIG: RetryManagerConfig = {
  maxRetries: 3,
  baseDelayMs: 30_000,
  maxDelayMs: 120_000,
  jitterPercent: 0.1,
};

/**
 * RateLimitRetryManager - Manages retry attempts with exponential backoff
 *
 * @class RateLimitRetryManager
 * @extends EventEmitter
 *
 * @description
 * Handles retry logic for rate-limited API calls before falling back to
 * another model. Uses exponential backoff (30s, 60s, 120s) with configurable
 * jitter to prevent thundering herd problems. Supports retry-after headers
 * from the API as a minimum delay floor.
 *
 * @example
 * const retryManager = new RateLimitRetryManager();
 *
 * retryManager.on('retry:waiting', (data) => {
 *   console.log(`Retry ${data.attempt}/${data.totalAttempts} in ${data.delayMs}ms`);
 * });
 *
 * while (retryManager.shouldRetry()) {
 *   const delay = retryManager.getNextDelay();
 *   await new Promise(r => setTimeout(r, delay));
 *   retryManager.recordAttempt();
 *   // attempt the request again
 * }
 *
 * AIDEV-WARNING: Always check shouldRetry() before calling getNextDelay()
 * AIDEV-NOTE: Call reset() when starting a new task or phase
 */
export class RateLimitRetryManager
  extends EventEmitter
  implements TypedRetryEmitter
{
  private config: RetryManagerConfig;
  private currentAttempt: number = 0;
  private retryAfterFloorMs: number | null = null;

  /**
   * Create a new RateLimitRetryManager
   *
   * @param config - Partial config, merged with defaults
   *
   * AIDEV-NOTE: All config fields are optional, defaults to 3 retries 30s/60s/120s
   */
  constructor(config?: Partial<RetryManagerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if more retry attempts are available
   *
   * @returns True if currentAttempt < maxRetries
   */
  shouldRetry(): boolean {
    return this.currentAttempt < this.config.maxRetries;
  }

  /**
   * Calculate the delay for the next retry attempt
   *
   * @param retryAfterMs - Optional retry-after value from API error (used as minimum floor)
   * @returns Delay in milliseconds with jitter applied
   *
   * AIDEV-NOTE: Exponential backoff formula: baseDelay * 2^attempt, capped at maxDelay
   * AIDEV-NOTE: If retryAfterMs is provided, it is used as the minimum delay
   */
  getNextDelay(retryAfterMs?: number): number {
    if (retryAfterMs != null) {
      this.retryAfterFloorMs = retryAfterMs;
    }

    // Exponential backoff: 30s, 60s, 120s
    const exponentialDelay = Math.min(
      this.config.baseDelayMs * Math.pow(2, this.currentAttempt),
      this.config.maxDelayMs
    );

    // Apply jitter: ±jitterPercent
    const jitterRange = exponentialDelay * this.config.jitterPercent;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    let delay = Math.round(exponentialDelay + jitter);

    // Use retry-after as floor if available
    if (this.retryAfterFloorMs != null && delay < this.retryAfterFloorMs) {
      delay = this.retryAfterFloorMs;
    }

    // Ensure non-negative
    return Math.max(0, delay);
  }

  /**
   * Record a retry attempt and emit progress events
   *
   * AIDEV-NOTE: Call this AFTER waiting the delay and BEFORE the actual retry request
   */
  recordAttempt(): void {
    this.currentAttempt++;

    this.emit('retry:attempting', {
      attempt: this.currentAttempt,
    });

    if (!this.shouldRetry()) {
      this.emit('retry:exhausted', {
        totalAttempts: this.currentAttempt,
      });
    }
  }

  /**
   * Emit a waiting event (call before sleeping)
   *
   * @param delayMs - The delay that will be waited
   *
   * AIDEV-NOTE: Separate from recordAttempt so caller controls the flow:
   *   1. emitWaiting(delay) -> 2. sleep(delay) -> 3. recordAttempt() -> 4. retry
   */
  emitWaiting(delayMs: number): void {
    this.emit('retry:waiting', {
      attempt: this.currentAttempt + 1,
      delayMs,
      totalAttempts: this.config.maxRetries,
    });
  }

  /**
   * Reset the manager for a new task or phase
   *
   * AIDEV-NOTE: Clears attempt counter and retry-after floor
   */
  reset(): void {
    this.currentAttempt = 0;
    this.retryAfterFloorMs = null;
  }

  /**
   * Get current attempt number (0-based)
   */
  getCurrentAttempt(): number {
    return this.currentAttempt;
  }

  /**
   * Get remaining retry attempts
   */
  getRemainingRetries(): number {
    return Math.max(0, this.config.maxRetries - this.currentAttempt);
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<RetryManagerConfig> {
    return { ...this.config };
  }

  /**
   * Dispose of the manager and clean up listeners
   *
   * AIDEV-WARNING: Call when task completes
   */
  dispose(): void {
    this.removeAllListeners();
    this.retryAfterFloorMs = null;
  }
}
