// apps/desktop/src/main/store/migrations/v005-fallback-settings.ts

/**
 * @migration v005-fallback-settings
 * @description Adds fallback system configuration tables for intelligent model switching
 *
 * @tables
 * - fallback_settings: Configuration for automatic fallback behavior
 * - fallback_logs: Audit trail of fallback events for analytics
 *
 * @context SaaS feature - allows customers to configure fallback behavior
 *
 * AIDEV-NOTE: This migration supports the hybrid fallback system that can:
 * - Switch to alternative models on rate limit errors
 * - Optionally use LLM summarization for context generation
 * - Track fallback events for billing/analytics
 */

import type { Database } from 'better-sqlite3';
import type { Migration } from './index';

export const migration: Migration = {
  version: 5,
  up(db: Database): void {
    // Fallback configuration table (singleton - only one row)
    db.exec(`
      CREATE TABLE IF NOT EXISTS fallback_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER DEFAULT 0,
        fallback_model_id TEXT,
        fallback_provider TEXT DEFAULT 'openrouter',
        max_retries INTEGER DEFAULT 3,
        retry_delay_ms INTEGER DEFAULT 5000,
        use_llm_summarization INTEGER DEFAULT 0,
        summarization_model_id TEXT,
        summarization_provider TEXT DEFAULT 'openrouter',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default settings row
    db.exec(`
      INSERT OR IGNORE INTO fallback_settings (id, enabled) VALUES (1, 0)
    `);

    // Fallback event logs for analytics and debugging
    db.exec(`
      CREATE TABLE IF NOT EXISTS fallback_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        session_id TEXT,
        original_model TEXT,
        original_provider TEXT,
        fallback_model TEXT,
        fallback_provider TEXT,
        error_type TEXT,
        error_message TEXT,
        context_method TEXT CHECK (context_method IN ('template', 'llm')),
        context_tokens INTEGER,
        success INTEGER DEFAULT 0,
        duration_ms INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index for querying logs by task
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fallback_logs_task_id ON fallback_logs(task_id)
    `);

    // Index for analytics queries by date
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fallback_logs_created_at ON fallback_logs(created_at)
    `);
  },
};
