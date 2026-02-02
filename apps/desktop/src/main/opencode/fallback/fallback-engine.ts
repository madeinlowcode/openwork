// apps/desktop/src/main/opencode/fallback/fallback-engine.ts

/**
 * @file fallback-engine.ts
 * @description Main orchestrator for the intelligent fallback system
 *
 * @context SaaS feature - automatically switches models on rate limit errors
 *
 * @dependencies
 * - events (EventEmitter)
 * - @accomplish/shared (FallbackSettings, FallbackLogEntry, TaskMessage)
 * - ./types.ts (FallbackEngineOptions, FallbackHandleResult, FallbackEngineEvents)
 * - ./rate-limit-detector.ts (detectRateLimit, isRateLimitError)
 * - ./context-generator.ts (generateContinuationContext)
 * - ../../store/repositories/fallbackSettings.ts (logFallbackEvent)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/adapter.ts (integrates engine)
 * - apps/desktop/src/main/ipc/handlers.ts (exposes to renderer)
 * - packages/shared/src/types/fallbackSettings.ts (type definitions)
 *
 * @stateManagement
 * - Tracks retry attempts per instance
 * - Emits events for UI feedback
 * - Logs all fallback events to database
 *
 * AIDEV-WARNING: Critical component - changes affect task reliability
 * AIDEV-NOTE: Each task should have its own FallbackEngine instance
 */

import { EventEmitter } from 'events';
import type { FallbackSettings, TaskMessage } from '@accomplish/shared';
import type {
  FallbackEngineOptions,
  FallbackHandleResult,
  FallbackEngineEvents,
  RateLimitErrorType,
  ContextGeneratorOptions,
} from './types';
import { detectRateLimit, isRateLimitError } from './rate-limit-detector';
import { generateContinuationContext } from './context-generator';
import { logFallbackEvent } from '../../store/repositories/fallbackSettings';

/**
 * Typed event emitter interface for FallbackEngine
 *
 * AIDEV-NOTE: Provides type-safe event handling
 */
interface TypedEventEmitter {
  on<K extends keyof FallbackEngineEvents>(
    event: K,
    listener: (data: FallbackEngineEvents[K]) => void
  ): this;
  emit<K extends keyof FallbackEngineEvents>(
    event: K,
    data: FallbackEngineEvents[K]
  ): boolean;
  off<K extends keyof FallbackEngineEvents>(
    event: K,
    listener: (data: FallbackEngineEvents[K]) => void
  ): this;
  removeAllListeners(event?: keyof FallbackEngineEvents): this;
}

/**
 * FallbackEngine - Orchestrates intelligent model fallback on rate limit errors
 *
 * @class FallbackEngine
 * @extends EventEmitter
 *
 * @description
 * The FallbackEngine monitors for rate limit errors and automatically
 * switches to a fallback model when detected. It generates context
 * to help the fallback model continue the task seamlessly.
 *
 * @example
 * const engine = new FallbackEngine({
 *   settings: fallbackSettings,
 *   taskId: 'task-123',
 *   originalModel: 'claude-opus-4-5',
 *   originalProvider: 'anthropic'
 * });
 *
 * engine.on('fallback:start', (data) => {
 *   console.log(`Switching to ${data.fallbackModel}`);
 * });
 *
 * const result = await engine.handleError(error, messages);
 * if (result.shouldFallback) {
 *   // Use result.context with fallback model
 * }
 *
 * AIDEV-WARNING: Create new instance for each task
 * AIDEV-NOTE: Remember to call dispose() when task completes
 */
export class FallbackEngine extends EventEmitter implements TypedEventEmitter {
  private settings: FallbackSettings;
  private taskId: string;
  private sessionId?: string;
  private originalModel: string;
  private originalProvider: string;
  private retryCount: number = 0;
  private fallbackStartTime?: number;
  private lastErrorType?: RateLimitErrorType;
  private isDisposed: boolean = false;

  /**
   * Create a new FallbackEngine instance
   *
   * @param options - Engine configuration options
   *
   * AIDEV-NOTE: Settings should be fetched from database before creating
   */
  constructor(options: FallbackEngineOptions) {
    super();
    this.settings = options.settings;
    this.taskId = options.taskId;
    this.sessionId = options.sessionId;
    this.originalModel = options.originalModel;
    this.originalProvider = options.originalProvider;
  }

  /**
   * Check if fallback is enabled and configured
   *
   * @returns True if fallback can be attempted
   *
   * AIDEV-NOTE: Checks both enabled flag and model configuration
   */
  private canFallback(): boolean {
    return (
      this.settings.enabled &&
      this.settings.fallbackModelId !== null &&
      this.settings.fallbackProvider !== null &&
      this.retryCount < this.settings.maxRetries
    );
  }

  /**
   * Build context generator options from settings
   *
   * @returns ContextGeneratorOptions for context generation
   */
  private getContextOptions(): ContextGeneratorOptions {
    return {
      useLLM: this.settings.useLLMSummarization,
      llmModelId: this.settings.summarizationModelId ?? undefined,
      llmProvider: this.settings.summarizationProvider,
    };
  }

  /**
   * Process an error and decide if fallback should occur
   *
   * @param error - The error that occurred
   * @param messages - Messages from the current task session
   * @param originalPrompt - Original user prompt (optional, extracted from messages if not provided)
   * @returns Promise resolving to fallback decision and context
   *
   * @example
   * const result = await engine.handleError(rateLimitError, taskMessages);
   * if (result.shouldFallback) {
   *   // Restart task with result.context on result.fallbackModel
   * }
   *
   * AIDEV-WARNING: May take time if LLM summarization is enabled
   * AIDEV-NOTE: Returns shouldFallback=false if not a rate limit or max retries exceeded
   */
  async handleError(
    error: string | Error,
    messages: TaskMessage[],
    originalPrompt?: string
  ): Promise<FallbackHandleResult> {
    // Check if disposed
    if (this.isDisposed) {
      console.warn('[FallbackEngine] handleError called on disposed engine');
      return { shouldFallback: false };
    }

    // Detect rate limit
    const detection = detectRateLimit(error);
    
    if (!detection.isRateLimit) {
      return { shouldFallback: false };
    }

    // Store error type for logging
    this.lastErrorType = detection.errorType;

    // Check if we can attempt fallback
    if (!this.canFallback()) {
      console.log(
        `[FallbackEngine] Cannot fallback: enabled=${this.settings.enabled}, ` +
        `model=${this.settings.fallbackModelId}, ` +
        `retries=${this.retryCount}/${this.settings.maxRetries}`
      );
      return {
        shouldFallback: false,
        errorType: detection.errorType,
      };
    }

    // Increment retry count
    this.retryCount++;
    this.fallbackStartTime = Date.now();

    // Extract original prompt from first user message if not provided
    const prompt = originalPrompt || this.extractOriginalPrompt(messages);

    // Emit start event
    this.emit('fallback:start', {
      originalModel: this.originalModel,
      originalProvider: this.originalProvider,
      fallbackModel: this.settings.fallbackModelId!,
      fallbackProvider: this.settings.fallbackProvider,
      errorType: detection.errorType,
    });

    try {
      // Generate context for continuation
      const contextResult = await generateContinuationContext(
        prompt,
        messages,
        this.getContextOptions()
      );

      // Emit context generated event
      this.emit('fallback:context-generated', {
        method: contextResult.method,
        tokens: contextResult.tokenCount,
      });

      return {
        shouldFallback: true,
        context: contextResult.context,
        fallbackModel: this.settings.fallbackModelId!,
        fallbackProvider: this.settings.fallbackProvider,
        contextMethod: contextResult.method,
        contextTokens: contextResult.tokenCount,
        errorType: detection.errorType,
      };
    } catch (contextError) {
      // Context generation failed
      const errorMsg = contextError instanceof Error 
        ? contextError.message 
        : String(contextError);
      
      console.error('[FallbackEngine] Context generation failed:', errorMsg);
      
      this.emit('fallback:error', {
        error: errorMsg,
        phase: 'context',
      });

      return {
        shouldFallback: false,
        errorType: detection.errorType,
      };
    }
  }

  /**
   * Extract original prompt from messages
   *
   * @param messages - Task messages
   * @returns Original user prompt
   *
   * AIDEV-NOTE: Looks for first user message
   */
  private extractOriginalPrompt(messages: TaskMessage[]): string {
    for (const msg of messages) {
      if (msg.type === 'user' && msg.content) {
        return msg.content;
      }
    }
    return '[Prompt não encontrado]';
  }

  /**
   * Log the result of a fallback attempt
   *
   * @param success - Whether the fallback was successful
   * @param durationMs - Duration of the fallback operation (optional, calculated if not provided)
   * @param errorMessage - Error message if failed (optional)
   *
   * @example
   * // After fallback completes
   * engine.logResult(true, 5000);
   *
   * // After fallback fails
   * engine.logResult(false, 3000, 'Connection timeout');
   *
   * AIDEV-NOTE: Stores result in fallback_logs table
   */
  logResult(success: boolean, durationMs?: number, errorMessage?: string): void {
    if (this.isDisposed) {
      console.warn('[FallbackEngine] logResult called on disposed engine');
      return;
    }

    const duration = durationMs ?? (
      this.fallbackStartTime 
        ? Date.now() - this.fallbackStartTime 
        : undefined
    );

    // Emit complete event
    this.emit('fallback:complete', {
      success,
      durationMs: duration ?? 0,
    });

    // Log to database
    try {
      logFallbackEvent({
        taskId: this.taskId,
        sessionId: this.sessionId,
        originalModel: this.originalModel,
        originalProvider: this.originalProvider,
        fallbackModel: this.settings.fallbackModelId ?? undefined,
        fallbackProvider: this.settings.fallbackProvider,
        errorType: this.lastErrorType ?? 'unknown',
        errorMessage: errorMessage,
        contextMethod: this.settings.useLLMSummarization ? 'llm' : 'template',
        success,
        durationMs: duration,
      });
    } catch (dbError) {
      console.error('[FallbackEngine] Failed to log fallback event:', dbError);
    }

    // Reset for potential next attempt
    this.fallbackStartTime = undefined;
  }

  /**
   * Get current retry count
   *
   * @returns Number of fallback attempts made
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get remaining retry attempts
   *
   * @returns Number of remaining attempts
   */
  getRemainingRetries(): number {
    return Math.max(0, this.settings.maxRetries - this.retryCount);
  }

  /**
   * Check if the engine is enabled
   *
   * @returns True if fallback system is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Get the configured fallback model
   *
   * @returns Fallback model ID or null if not configured
   */
  getFallbackModel(): string | null {
    return this.settings.fallbackModelId;
  }

  /**
   * Get the configured fallback provider
   *
   * @returns Fallback provider
   */
  getFallbackProvider(): string {
    return this.settings.fallbackProvider;
  }

  /**
   * Update settings (e.g., after user changes configuration)
   *
   * @param settings - New settings to apply
   *
   * AIDEV-NOTE: Does not affect in-progress fallback operations
   */
  updateSettings(settings: FallbackSettings): void {
    this.settings = settings;
  }

  /**
   * Reset retry counter
   *
   * AIDEV-NOTE: Use when starting a new phase of the task
   */
  resetRetries(): void {
    this.retryCount = 0;
    this.fallbackStartTime = undefined;
    this.lastErrorType = undefined;
  }

  /**
   * Dispose of the engine
   *
   * AIDEV-WARNING: Call this when task completes to clean up
   */
  dispose(): void {
    this.isDisposed = true;
    this.removeAllListeners();
    this.fallbackStartTime = undefined;
  }

  /**
   * Check if engine is disposed
   *
   * @returns True if engine has been disposed
   */
  isEngineDisposed(): boolean {
    return this.isDisposed;
  }
}

/**
 * Create a FallbackEngine instance from settings
 *
 * @param options - Engine options
 * @returns New FallbackEngine instance
 *
 * @example
 * import { getFallbackSettings } from '../../store/repositories/fallbackSettings';
 *
 * const settings = getFallbackSettings();
 * const engine = createFallbackEngine({
 *   settings,
 *   taskId: 'task-123',
 *   originalModel: 'claude-opus-4-5',
 *   originalProvider: 'anthropic'
 * });
 *
 * AIDEV-NOTE: Convenience function for creating engines
 */
export function createFallbackEngine(
  options: FallbackEngineOptions
): FallbackEngine {
  return new FallbackEngine(options);
}

/**
 * Quick check if an error should trigger fallback
 *
 * @param error - Error to check
 * @param settings - Fallback settings
 * @returns True if fallback should be considered
 *
 * @example
 * if (shouldTriggerFallback(error, settings)) {
 *   const engine = createFallbackEngine({ settings, ... });
 *   // Handle fallback
 * }
 *
 * AIDEV-NOTE: Use for quick pre-check before creating engine
 */
export function shouldTriggerFallback(
  error: string | Error,
  settings: FallbackSettings
): boolean {
  if (!settings.enabled) {
    return false;
  }
  if (!settings.fallbackModelId) {
    return false;
  }
  return isRateLimitError(error);
}
