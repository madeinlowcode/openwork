// apps/desktop/src/main/store/migrations/v007-token-usage.ts

/**
 * @migration v007-token-usage
 * @description Adds token usage tracking table and summary view for monitoring
 * API consumption, costs, and model usage across tasks
 *
 * @tables
 * - token_usage: Stores per-step token consumption and cost data
 *
 * @views
 * - token_usage_summary: Aggregated token/cost stats per task
 *
 * @context Token Usage Tracking - enables cost monitoring and usage analytics
 *
 * @dependencies
 * - apps/desktop/src/main/store/repositories/tokenUsage.ts (future)
 * - apps/desktop/src/main/opencode/adapter.ts (data source)
 *
 * @relatedFiles
 * - packages/shared/src/types/token-usage.ts (future shared types)
 *
 * AIDEV-NOTE: task_id is TEXT without FK constraint — tasks table name may vary
 * AIDEV-NOTE: source column uses CHECK constraint to enforce valid values
 * AIDEV-WARNING: Do not add FK to tasks table without verifying exact table name
 */
import type { Database } from 'better-sqlite3';
import type { Migration } from './index';

export const migration: Migration = {
  version: 7,
  up(db: Database): void {
    // Token usage tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        session_id TEXT,
        user_id TEXT,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('primary', 'retry', 'fallback', 'continuation', 'summarization')),
        step_number INTEGER,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        reasoning_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL,
        cost_estimated REAL,
        is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
        step_count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Index for querying by task
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id)
    `);

    // Index for querying by date
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at)
    `);

    // Index for querying by model/provider
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model_id, provider)
    `);

    // Index for querying by source type
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_source ON token_usage(source)
    `);

    // Index for querying by user
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id)
    `);

    // Aggregated view for per-task summaries
    db.exec(`
      CREATE VIEW IF NOT EXISTS token_usage_summary AS
      SELECT
        task_id,
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(reasoning_tokens) as total_reasoning,
        SUM(cost_usd) as total_cost,
        SUM(cost_estimated) as total_cost_estimated,
        GROUP_CONCAT(DISTINCT model_id) as models_used,
        GROUP_CONCAT(DISTINCT source) as sources_used,
        COUNT(*) as total_entries
      FROM token_usage
      GROUP BY task_id
    `);
  },
};
