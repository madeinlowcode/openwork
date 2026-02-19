// apps/desktop/src/main/store/repositories/tokenUsage.ts

/**
 * @repository TokenUsageRepository
 * @description Persists and queries token usage data for monitoring API consumption,
 * costs, and model usage across tasks. Uses the token_usage table and
 * token_usage_summary view created in migration v007.
 *
 * @context Token Usage Tracking - cost monitoring and usage analytics
 *
 * @dependencies
 * - apps/desktop/src/main/store/db.ts (getDatabase)
 * - apps/desktop/src/main/store/migrations/v007-token-usage.ts (schema)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/adapter.ts (data source)
 * - apps/desktop/src/main/store/repositories/taskHistory.ts (task context)
 *
 * @usedBy
 * - (future) apps/desktop/src/main/ipc/handlers.ts
 * - (future) apps/desktop/src/renderer/pages/History.tsx
 *
 * AIDEV-WARNING: token_usage table has no FK to tasks - task_id is a TEXT reference
 * AIDEV-NOTE: Uses prepared statements for all queries
 * AIDEV-NOTE: Follows same pattern as taskHistory.ts repository
 */

import { getDatabase } from '../db';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TokenUsageRecord {
  taskId: string;
  sessionId?: string;
  userId?: string;
  modelId: string;
  provider: string;
  source: 'primary' | 'retry' | 'fallback' | 'continuation' | 'summarization';
  stepNumber?: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd?: number;
  costEstimated?: number;
  isEstimated: boolean;
  stepCount: number;
}

export interface TaskUsageSummary {
  taskId: string;
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCost: number;
  totalCostEstimated: number;
  modelsUsed: string;
  sourcesUsed: string;
  totalEntries: number;
}

export interface DailySummary {
  date: string;
  totalInput: number;
  totalOutput: number;
  totalCost: number;
  taskCount: number;
}

// ─── Row types (SQLite column mapping) ───────────────────────────────────────

interface TokenUsageRow {
  id: number;
  task_id: string;
  session_id: string | null;
  user_id: string | null;
  model_id: string;
  provider: string;
  source: string;
  step_number: number | null;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | null;
  cost_estimated: number | null;
  is_estimated: number;
  step_count: number;
  created_at: string;
}

interface SummaryRow {
  task_id: string;
  total_input: number;
  total_output: number;
  total_reasoning: number;
  total_cost: number | null;
  total_cost_estimated: number | null;
  models_used: string;
  sources_used: string;
  total_entries: number;
}

interface DailySummaryRow {
  date: string;
  total_input: number;
  total_output: number;
  total_cost: number | null;
  task_count: number;
}

// ─── Row converters ──────────────────────────────────────────────────────────

function rowToRecord(row: TokenUsageRow): TokenUsageRecord {
  return {
    taskId: row.task_id,
    sessionId: row.session_id || undefined,
    userId: row.user_id || undefined,
    modelId: row.model_id,
    provider: row.provider,
    source: row.source as TokenUsageRecord['source'],
    stepNumber: row.step_number ?? undefined,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    reasoningTokens: row.reasoning_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    costUsd: row.cost_usd ?? undefined,
    costEstimated: row.cost_estimated ?? undefined,
    isEstimated: row.is_estimated === 1,
    stepCount: row.step_count,
  };
}

function rowToSummary(row: SummaryRow): TaskUsageSummary {
  return {
    taskId: row.task_id,
    totalInput: row.total_input,
    totalOutput: row.total_output,
    totalReasoning: row.total_reasoning,
    totalCost: row.total_cost ?? 0,
    totalCostEstimated: row.total_cost_estimated ?? 0,
    modelsUsed: row.models_used,
    sourcesUsed: row.sources_used,
    totalEntries: row.total_entries,
  };
}

// ─── Repository functions ────────────────────────────────────────────────────

/**
 * @function saveUsage
 * @description Inserts a single token usage record into the database
 *
 * @param {TokenUsageRecord} record - Token usage data to persist
 */
export function saveUsage(record: TokenUsageRecord): void {
  const db = getDatabase();

  db.prepare(
    `INSERT INTO token_usage
      (task_id, session_id, user_id, model_id, provider, source, step_number,
       input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens,
       cost_usd, cost_estimated, is_estimated, step_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.taskId,
    record.sessionId || null,
    record.userId || null,
    record.modelId,
    record.provider,
    record.source,
    record.stepNumber ?? null,
    record.inputTokens,
    record.outputTokens,
    record.reasoningTokens,
    record.cacheReadTokens,
    record.cacheWriteTokens,
    record.costUsd ?? null,
    record.costEstimated ?? null,
    record.isEstimated ? 1 : 0,
    record.stepCount
  );
}

/**
 * @function saveBatch
 * @description Inserts multiple token usage records in a single transaction for performance
 *
 * @param {TokenUsageRecord[]} records - Array of token usage records
 *
 * AIDEV-PERF: Uses transaction + prepared statement for batch insert performance
 */
export function saveBatch(records: TokenUsageRecord[]): void {
  if (records.length === 0) return;

  const db = getDatabase();

  db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO token_usage
        (task_id, session_id, user_id, model_id, provider, source, step_number,
         input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens,
         cost_usd, cost_estimated, is_estimated, step_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const record of records) {
      stmt.run(
        record.taskId,
        record.sessionId || null,
        record.userId || null,
        record.modelId,
        record.provider,
        record.source,
        record.stepNumber ?? null,
        record.inputTokens,
        record.outputTokens,
        record.reasoningTokens,
        record.cacheReadTokens,
        record.cacheWriteTokens,
        record.costUsd ?? null,
        record.costEstimated ?? null,
        record.isEstimated ? 1 : 0,
        record.stepCount
      );
    }
  })();
}

/**
 * @function getByTaskId
 * @description Retrieves all token usage records for a specific task
 *
 * @param {string} taskId - The task ID to query
 * @returns {TokenUsageRecord[]} Array of usage records ordered by creation time
 */
export function getByTaskId(taskId: string): TokenUsageRecord[] {
  const db = getDatabase();

  const rows = db
    .prepare('SELECT * FROM token_usage WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId) as TokenUsageRow[];

  return rows.map(rowToRecord);
}

/**
 * @function getSummaryByTask
 * @description Retrieves aggregated token usage summary for a task using the token_usage_summary view
 *
 * @param {string} taskId - The task ID to query
 * @returns {TaskUsageSummary | null} Aggregated summary or null if no data
 *
 * AIDEV-NOTE: Uses the token_usage_summary VIEW from migration v007
 */
export function getSummaryByTask(taskId: string): TaskUsageSummary | null {
  const db = getDatabase();

  const row = db
    .prepare('SELECT * FROM token_usage_summary WHERE task_id = ?')
    .get(taskId) as SummaryRow | undefined;

  return row ? rowToSummary(row) : null;
}

/**
 * @function getByDateRange
 * @description Retrieves token usage records within a date range
 *
 * @param {string} start - Start date (ISO format, inclusive)
 * @param {string} end - End date (ISO format, inclusive)
 * @returns {TokenUsageRecord[]} Array of usage records
 */
export function getByDateRange(start: string, end: string): TokenUsageRecord[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      'SELECT * FROM token_usage WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC'
    )
    .all(start, end) as TokenUsageRow[];

  return rows.map(rowToRecord);
}

/**
 * @function getDailySummary
 * @description Retrieves aggregated daily token usage for the last N days
 *
 * @param {number} days - Number of days to look back
 * @returns {DailySummary[]} Array of daily summaries ordered by date descending
 */
export function getDailySummary(days: number): DailySummary[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
        date(created_at) as date,
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(cost_usd) as total_cost,
        COUNT(DISTINCT task_id) as task_count
      FROM token_usage
      WHERE created_at >= datetime('now', ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date DESC`
    )
    .all(`-${days}`) as DailySummaryRow[];

  return rows.map((row) => ({
    date: row.date,
    totalInput: row.total_input,
    totalOutput: row.total_output,
    totalCost: row.total_cost ?? 0,
    taskCount: row.task_count,
  }));
}

/**
 * @function deleteByTaskId
 * @description Deletes all token usage records for a specific task
 *
 * @param {string} taskId - The task ID whose records should be deleted
 *
 * AIDEV-WARNING: Irreversible operation - all usage data for the task will be lost
 */
export function deleteByTaskId(taskId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM token_usage WHERE task_id = ?').run(taskId);
}
