// packages/shared/src/types/fallbackSettings.ts

/**
 * @file fallbackSettings.ts
 * @description Types for the intelligent fallback system configuration and logging
 *
 * @context SaaS feature - allows automatic model switching on rate limit errors
 *
 * @relatedFiles
 * - apps/desktop/src/main/store/migrations/v005-fallback-settings.ts (database schema)
 * - apps/desktop/src/main/store/repositories/fallbackSettings.ts (data access)
 *
 * AIDEV-NOTE: These types map directly to the fallback_settings and fallback_logs tables
 * AIDEV-WARNING: Changes here must be synchronized with the database schema
 */

import type { ProviderType } from './provider';

/**
 * Fallback system configuration settings
 *
 * @description Singleton configuration stored in fallback_settings table (id=1)
 *
 * AIDEV-NOTE: enabled=false means fallback system is disabled entirely
 * AIDEV-NOTE: useLLMSummarization=true uses AI to generate context, false uses template
 */
export interface FallbackSettings {
  /** Whether the fallback system is enabled */
  enabled: boolean;
  /** Model ID to use as fallback (e.g., "anthropic/claude-sonnet-4-5") */
  fallbackModelId: string | null;
  /** Provider for the fallback model */
  fallbackProvider: ProviderType | string;
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;
  /** Delay in milliseconds between retry attempts */
  retryDelayMs: number;
  /** Whether to use LLM-based summarization for context generation */
  useLLMSummarization: boolean;
  /** Model ID for summarization (if useLLMSummarization is true) */
  summarizationModelId: string | null;
  /** Provider for the summarization model */
  summarizationProvider: ProviderType | string;
}

/**
 * Default fallback settings
 *
 * AIDEV-NOTE: These match the defaults in migration v005
 */
export const DEFAULT_FALLBACK_SETTINGS: FallbackSettings = {
  enabled: false,
  fallbackModelId: null,
  fallbackProvider: 'openrouter',
  maxRetries: 3,
  retryDelayMs: 5000,
  useLLMSummarization: false,
  summarizationModelId: null,
  summarizationProvider: 'openrouter',
};

/**
 * Fallback event log entry
 *
 * @description Records each fallback event for analytics and debugging
 *
 * AIDEV-NOTE: taskId is required, all other fields are optional for flexibility
 * AIDEV-NOTE: contextMethod indicates whether template or LLM was used for context
 */
export interface FallbackLogEntry {
  /** Auto-generated ID (optional when creating) */
  id?: number;
  /** ID of the task that triggered the fallback */
  taskId: string;
  /** Session ID for grouping related fallback events */
  sessionId?: string;
  /** Original model that failed (e.g., "claude-opus-4-5") */
  originalModel?: string;
  /** Original provider that failed */
  originalProvider?: string;
  /** Fallback model used */
  fallbackModel?: string;
  /** Fallback provider used */
  fallbackProvider?: string;
  /** Type of error that triggered fallback (e.g., "rate_limit", "timeout") */
  errorType?: string;
  /** Error message details */
  errorMessage?: string;
  /** Method used for context generation */
  contextMethod?: 'template' | 'llm';
  /** Number of tokens in the context */
  contextTokens?: number;
  /** Whether the fallback was successful */
  success: boolean;
  /** Duration of the fallback operation in milliseconds */
  durationMs?: number;
  /** Timestamp when the event occurred */
  createdAt?: string;
}

/**
 * Input type for creating a new fallback log entry
 *
 * AIDEV-NOTE: Omits auto-generated fields (id, createdAt)
 */
export type FallbackLogInput = Omit<FallbackLogEntry, 'id' | 'createdAt'>;
