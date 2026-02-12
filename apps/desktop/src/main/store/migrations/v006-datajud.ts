// apps/desktop/src/main/store/migrations/v006-datajud.ts

/**
 * @migration v006-datajud
 * @description Adds DataJud search history table for caching and history tracking
 *
 * @tables
 * - datajud_searches: Stores search history and cached results
 *
 * @context DataJud API Integration - enables search history and result caching
 *
 * @dependencies
 * - apps/desktop/src/main/services/datajud.ts
 * - apps/desktop/src/main/store/repositories/datajudSearches.ts
 *
 * AIDEV-NOTE: This migration enables:
 * - Search history for user reference
 * - Result caching to reduce API calls
 * - Association with tasks for audit trail
 */
import type { Database } from 'better-sqlite3';
import type { Migration } from './index';

export const migration: Migration = {
  version: 6,
  up(db: Database): void {
    // DataJud search history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS datajud_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        court TEXT NOT NULL,
        query_type TEXT NOT NULL,
        query_value TEXT NOT NULL,
        result_count INTEGER DEFAULT 0,
        response_data TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        task_id TEXT
      )
    `);

    // Index for querying recent searches
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_datajud_searches_created_at ON datajud_searches(created_at DESC)
    `);

    // Index for querying by court
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_datajud_searches_court ON datajud_searches(court)
    `);

    // Index for querying by task
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_datajud_searches_task_id ON datajud_searches(task_id)
    `);

    // Note: No foreign key constraint to tasks table to avoid migration complexity
    // Task association is informational only
  },
};
