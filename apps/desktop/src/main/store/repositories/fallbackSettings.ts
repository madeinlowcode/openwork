// apps/desktop/src/main/store/repositories/fallbackSettings.ts

/**
 * @file fallbackSettings.ts
 * @description Repository for fallback system configuration and event logging
 *
 * @context SaaS feature - manages automatic model switching on rate limit errors
 *
 * @dependencies
 * - @accomplish/shared (FallbackSettings, FallbackLogEntry, FallbackLogInput)
 * - ../db.ts (getDatabase)
 *
 * @relatedFiles
 * - apps/desktop/src/main/store/migrations/v005-fallback-settings.ts (database schema)
 * - packages/shared/src/types/fallbackSettings.ts (type definitions)
 *
 * @databaseTables
 * - fallback_settings (SELECT, UPDATE)
 * - fallback_logs (SELECT, INSERT, DELETE)
 *
 * AIDEV-WARNING: This repository is critical for the fallback system
 * AIDEV-NOTE: Settings use singleton pattern (id=1 in fallback_settings table)
 * AIDEV-NOTE: Follows same pattern as appSettings.ts repository
 */

import type {
  FallbackSettings,
  FallbackLogEntry,
  FallbackLogInput,
} from '@accomplish/shared';
import { getDatabase } from '../db';

/**
 * Database row type for fallback_settings table
 *
 * AIDEV-NOTE: Maps snake_case DB columns to interface
 */
interface FallbackSettingsRow {
  id: number;
  enabled: number;
  fallback_model_id: string | null;
  fallback_provider: string;
  max_retries: number;
  retry_delay_ms: number;
  use_llm_summarization: number;
  summarization_model_id: string | null;
  summarization_provider: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for fallback_logs table
 *
 * AIDEV-NOTE: Maps snake_case DB columns to interface
 */
interface FallbackLogRow {
  id: number;
  task_id: string;
  session_id: string | null;
  original_model: string | null;
  original_provider: string | null;
  fallback_model: string | null;
  fallback_provider: string | null;
  error_type: string | null;
  error_message: string | null;
  context_method: string | null;
  context_tokens: number | null;
  success: number;
  duration_ms: number | null;
  created_at: string;
}

// ============================================================================
// Settings Functions
// ============================================================================

/**
 * Get the raw settings row from database
 *
 * AIDEV-NOTE: Internal function, returns raw DB row
 */
function getSettingsRow(): FallbackSettingsRow {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM fallback_settings WHERE id = 1')
    .get() as FallbackSettingsRow;
}

/**
 * Get all fallback settings
 *
 * @returns {FallbackSettings} Current fallback configuration
 *
 * @example
 * const settings = getFallbackSettings();
 * if (settings.enabled) {
 *   // Use fallback system
 * }
 *
 * AIDEV-NOTE: Converts SQLite integers to booleans
 */
export function getFallbackSettings(): FallbackSettings {
  const row = getSettingsRow();
  return {
    enabled: row.enabled === 1,
    fallbackModelId: row.fallback_model_id,
    fallbackProvider: row.fallback_provider,
    maxRetries: row.max_retries,
    retryDelayMs: row.retry_delay_ms,
    useLLMSummarization: row.use_llm_summarization === 1,
    summarizationModelId: row.summarization_model_id,
    summarizationProvider: row.summarization_provider,
  };
}

/**
 * Update fallback settings (partial update supported)
 *
 * @param {Partial<FallbackSettings>} settings - Settings to update
 *
 * @example
 * updateFallbackSettings({ enabled: true, maxRetries: 5 });
 *
 * AIDEV-WARNING: Only updates provided fields, others remain unchanged
 * AIDEV-NOTE: Converts booleans to SQLite integers
 */
export function updateFallbackSettings(
  settings: Partial<FallbackSettings>
): void {
  const db = getDatabase();

  // Build dynamic UPDATE query based on provided fields
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (settings.enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(settings.enabled ? 1 : 0);
  }

  if (settings.fallbackModelId !== undefined) {
    updates.push('fallback_model_id = ?');
    values.push(settings.fallbackModelId);
  }

  if (settings.fallbackProvider !== undefined) {
    updates.push('fallback_provider = ?');
    values.push(settings.fallbackProvider);
  }

  if (settings.maxRetries !== undefined) {
    updates.push('max_retries = ?');
    values.push(settings.maxRetries);
  }

  if (settings.retryDelayMs !== undefined) {
    updates.push('retry_delay_ms = ?');
    values.push(settings.retryDelayMs);
  }

  if (settings.useLLMSummarization !== undefined) {
    updates.push('use_llm_summarization = ?');
    values.push(settings.useLLMSummarization ? 1 : 0);
  }

  if (settings.summarizationModelId !== undefined) {
    updates.push('summarization_model_id = ?');
    values.push(settings.summarizationModelId);
  }

  if (settings.summarizationProvider !== undefined) {
    updates.push('summarization_provider = ?');
    values.push(settings.summarizationProvider);
  }

  if (updates.length === 0) {
    return; // Nothing to update
  }

  // Always update timestamp
  updates.push('updated_at = CURRENT_TIMESTAMP');

  const query = `UPDATE fallback_settings SET ${updates.join(', ')} WHERE id = 1`;
  db.prepare(query).run(...values);
}

/**
 * Check if fallback system is enabled
 *
 * @returns {boolean} True if fallback is enabled
 *
 * @example
 * if (isFallbackEnabled()) {
 *   // Attempt fallback on error
 * }
 *
 * AIDEV-NOTE: Convenience method for quick checks
 */
export function isFallbackEnabled(): boolean {
  return getSettingsRow().enabled === 1;
}

// ============================================================================
// Log Functions
// ============================================================================

/**
 * Log a fallback event
 *
 * @param {FallbackLogInput} entry - Log entry data (without id and createdAt)
 *
 * @example
 * logFallbackEvent({
 *   taskId: 'task-123',
 *   originalModel: 'claude-opus-4-5',
 *   originalProvider: 'anthropic',
 *   fallbackModel: 'claude-sonnet-4-5',
 *   fallbackProvider: 'anthropic',
 *   errorType: 'rate_limit',
 *   success: true,
 *   durationMs: 1500
 * });
 *
 * AIDEV-NOTE: createdAt is auto-set by database default
 */
export function logFallbackEvent(entry: FallbackLogInput): void {
  const db = getDatabase();

  db.prepare(
    `INSERT INTO fallback_logs (
      task_id,
      session_id,
      original_model,
      original_provider,
      fallback_model,
      fallback_provider,
      error_type,
      error_message,
      context_method,
      context_tokens,
      success,
      duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.taskId,
    entry.sessionId ?? null,
    entry.originalModel ?? null,
    entry.originalProvider ?? null,
    entry.fallbackModel ?? null,
    entry.fallbackProvider ?? null,
    entry.errorType ?? null,
    entry.errorMessage ?? null,
    entry.contextMethod ?? null,
    entry.contextTokens ?? null,
    entry.success ? 1 : 0,
    entry.durationMs ?? null
  );
}

/**
 * Convert database row to FallbackLogEntry
 *
 * AIDEV-NOTE: Internal helper for row mapping
 */
function rowToLogEntry(row: FallbackLogRow): FallbackLogEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    sessionId: row.session_id ?? undefined,
    originalModel: row.original_model ?? undefined,
    originalProvider: row.original_provider ?? undefined,
    fallbackModel: row.fallback_model ?? undefined,
    fallbackProvider: row.fallback_provider ?? undefined,
    errorType: row.error_type ?? undefined,
    errorMessage: row.error_message ?? undefined,
    contextMethod: row.context_method as 'template' | 'llm' | undefined,
    contextTokens: row.context_tokens ?? undefined,
    success: row.success === 1,
    durationMs: row.duration_ms ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Get fallback logs with optional limit
 *
 * @param {number} limit - Maximum number of entries to return (default: 100)
 * @returns {FallbackLogEntry[]} Array of log entries, newest first
 *
 * @example
 * const recentLogs = getFallbackLogs(10);
 * const allLogs = getFallbackLogs();
 *
 * AIDEV-NOTE: Returns newest entries first (ORDER BY created_at DESC)
 */
export function getFallbackLogs(limit: number = 100): FallbackLogEntry[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT * FROM fallback_logs
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as FallbackLogRow[];

  return rows.map(rowToLogEntry);
}

/**
 * Get fallback logs for a specific task
 *
 * @param {string} taskId - Task ID to filter by
 * @returns {FallbackLogEntry[]} Array of log entries for the task
 *
 * @example
 * const taskLogs = getFallbackLogsByTask('task-123');
 *
 * AIDEV-NOTE: Returns newest entries first
 */
export function getFallbackLogsByTask(taskId: string): FallbackLogEntry[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT * FROM fallback_logs
       WHERE task_id = ?
       ORDER BY created_at DESC`
    )
    .all(taskId) as FallbackLogRow[];

  return rows.map(rowToLogEntry);
}

/**
 * Clear all fallback logs
 *
 * @example
 * clearFallbackLogs();
 *
 * AIDEV-WARNING: This permanently deletes all log data
 * AIDEV-NOTE: Use for cleanup or testing purposes only
 */
export function clearFallbackLogs(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM fallback_logs').run();
}

/**
 * Get fallback statistics
 *
 * @returns {object} Statistics about fallback usage
 *
 * @example
 * const stats = getFallbackStats();
 * console.log(`Success rate: ${stats.successRate}%`);
 *
 * AIDEV-NOTE: Useful for analytics dashboard
 */
export function getFallbackStats(): {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  avgDurationMs: number | null;
} {
  const db = getDatabase();

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(duration_ms) as avg_duration
       FROM fallback_logs`
    )
    .get() as {
    total: number;
    successful: number;
    failed: number;
    avg_duration: number | null;
  };

  return {
    totalEvents: stats.total,
    successfulEvents: stats.successful,
    failedEvents: stats.failed,
    successRate:
      stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0,
    avgDurationMs: stats.avg_duration
      ? Math.round(stats.avg_duration)
      : null,
  };
}
