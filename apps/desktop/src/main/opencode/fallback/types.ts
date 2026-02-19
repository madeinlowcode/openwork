// apps/desktop/src/main/opencode/fallback/types.ts

/**
 * @file types.ts
 * @description Internal types for the fallback engine
 *
 * @context Fallback system - defines internal engine types not exposed to shared package
 *
 * @dependencies
 * - @accomplish/shared (FallbackSettings, TaskMessage)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/fallback/fallback-engine.ts (main consumer)
 * - apps/desktop/src/main/opencode/fallback/context-generator.ts (uses ContextGeneratorOptions)
 * - packages/shared/src/types/fallbackSettings.ts (public types)
 *
 * AIDEV-NOTE: These types are internal to the fallback engine
 * AIDEV-WARNING: Changes here may affect multiple fallback components
 */

import type { FallbackSettings, TaskMessage } from '@accomplish/shared';

/**
 * Rate limit error detection result
 *
 * @description Contains information about a detected rate limit error
 *
 * AIDEV-NOTE: provider is null if we can't determine which provider caused the error
 */
export interface RateLimitDetectionResult {
  /** Whether the error is a rate limit error */
  isRateLimit: boolean;
  /** Provider that caused the rate limit (if detectable) */
  provider: string | null;
  /** Suggested retry delay in milliseconds (if available in error) */
  retryAfterMs: number | null;
  /** The error type classification */
  errorType: RateLimitErrorType;
}

/**
 * Types of rate limit errors
 *
 * AIDEV-NOTE: Used for logging and analytics
 */
export type RateLimitErrorType =
  | 'rate_limit'
  | 'quota_exceeded'
  | 'too_many_requests'
  | 'concurrent_limit'
  | 'unknown';

/**
 * Options for context generation
 *
 * @description Controls how continuation context is generated
 *
 * AIDEV-NOTE: useLLM=true requires llmModelId and llmProvider
 * AIDEV-NOTE: maxTokens limits the context size sent to fallback model
 */
export interface ContextGeneratorOptions {
  /** Whether to use LLM for summarization (true = paid, false = template) */
  useLLM: boolean;
  /** Model ID for LLM summarization (required if useLLM is true) */
  llmModelId?: string;
  /** Provider for LLM summarization (required if useLLM is true) */
  llmProvider?: string;
  /** Maximum tokens for generated context */
  maxTokens?: number;
}

/**
 * Result of context generation
 *
 * AIDEV-NOTE: tokenCount is estimated for template mode
 */
export interface ContextGenerationResult {
  /** Generated context string */
  context: string;
  /** Method used for generation */
  method: 'template' | 'llm';
  /** Estimated token count */
  tokenCount: number;
  /** Tokens consumed by LLM summarization Edge Function (only when method='llm') */
  llmTokensUsed?: number;
  /** Model used by LLM summarization Edge Function (only when method='llm') */
  llmModel?: string;
}

/**
 * Options for creating a FallbackEngine instance
 *
 * @description Configuration for the fallback engine
 *
 * AIDEV-WARNING: settings.enabled should be true before creating an engine
 */
export interface FallbackEngineOptions {
  /** Fallback system settings from database */
  settings: FallbackSettings;
  /** ID of the current task */
  taskId: string;
  /** Session ID for tracking (optional) */
  sessionId?: string;
  /** Original model that failed */
  originalModel: string;
  /** Original provider that failed */
  originalProvider: string;
}

/**
 * Result of handling an error in the fallback engine
 *
 * AIDEV-NOTE: If shouldFallback is false, context/fallbackModel/fallbackProvider are undefined
 */
export interface FallbackHandleResult {
  /** Whether fallback should be attempted */
  shouldFallback: boolean;
  /** Generated context for continuation (if shouldFallback is true) */
  context?: string;
  /** Model to use for fallback (if shouldFallback is true) */
  fallbackModel?: string;
  /** Provider to use for fallback (if shouldFallback is true) */
  fallbackProvider?: string;
  /** Method used for context generation */
  contextMethod?: 'template' | 'llm';
  /** Estimated token count of context */
  contextTokens?: number;
  /** Error type classification */
  errorType?: RateLimitErrorType;
}

/**
 * Events emitted by the FallbackEngine
 *
 * @description Event types for monitoring fallback operations
 *
 * AIDEV-NOTE: Use these for IPC events to renderer
 */
export interface FallbackEngineEvents {
  /** Emitted when fallback process starts */
  'fallback:start': {
    originalModel: string;
    originalProvider: string;
    fallbackModel: string;
    fallbackProvider: string;
    errorType: RateLimitErrorType;
  };
  /** Emitted when context generation completes */
  'fallback:context-generated': {
    method: 'template' | 'llm';
    tokens: number;
  };
  /** Emitted when fallback process completes */
  'fallback:complete': {
    success: boolean;
    durationMs: number;
  };
  /** Emitted on fallback errors */
  'fallback:error': {
    error: string;
    phase: 'detection' | 'context' | 'execution';
  };
}

/**
 * Tool call representation for translation
 *
 * AIDEV-NOTE: Generic structure for tool calls from various sources
 */
export interface ToolCallInfo {
  tool_name: string;
  tool_input: unknown;
}

/**
 * Translated action for context generation
 *
 * AIDEV-NOTE: Human-readable representation of a tool call
 */
export interface TranslatedAction {
  /** Original tool name */
  toolName: string;
  /** Human-readable description */
  description: string;
  /** Timestamp if available */
  timestamp?: string;
}

/**
 * Configuration for the RateLimitRetryManager
 *
 * AIDEV-NOTE: Defaults are 3 retries with 30s/60s/120s delays + 10% jitter
 */
export interface RetryManagerConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds for first retry (default: 30000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (default: 120000) */
  maxDelayMs: number;
  /** Jitter percentage to prevent thundering herd (default: 0.1) */
  jitterPercent: number;
}

/**
 * Events emitted by the RateLimitRetryManager
 *
 * AIDEV-NOTE: Use for IPC events to renderer for retry progress UI
 */
export interface RetryManagerEvents {
  /** Emitted when waiting before a retry attempt */
  'retry:waiting': {
    attempt: number;
    delayMs: number;
    totalAttempts: number;
  };
  /** Emitted when a retry attempt starts */
  'retry:attempting': {
    attempt: number;
  };
  /** Emitted when all retry attempts are exhausted */
  'retry:exhausted': {
    totalAttempts: number;
  };
}
