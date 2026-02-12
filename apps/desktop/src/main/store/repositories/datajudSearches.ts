// apps/desktop/src/main/store/repositories/datajudSearches.ts

/**
 * DataJud Search History Repository
 *
 * @description CRUD operations for DataJud search history in SQLite
 *
 * @context Main process repository for storing/searching DataJud API results
 *
 * @dependencies
 * - apps/desktop/src/main/db.ts (getDatabase)
 * - packages/shared/src/types/datajud.ts (DataJudSearchHistoryRecord)
 *
 * @usedBy
 * - apps/desktop/src/main/ipc/datajud-handlers.ts
 * - apps/desktop/src/main/mcp/datajud-server.ts
 *
 * ⚠️ AIDEV-NOTE: Response data is stored as JSON string for flexibility
 * 🔒 AIDEV-SECURITY: No sensitive data stored, privacy filter applied before save
 */

import type { DataJudSearchHistoryRecord, DataJudQuery, DataJudSearchResult } from '@accomplish/shared';
import { getDatabase } from '../db';

/**
 * Maximum number of searches to keep in history
 */
const MAX_HISTORY_ITEMS = 100;

/**
 * Database row interface for DataJud searches
 */
interface DataJudSearchRow {
  id: number;
  court: string;
  query_type: string;
  query_value: string;
  result_count: number;
  response_data: string | null;
  created_at: number;
  task_id: string | null;
}

/**
 * Convert database row to API record type
 */
function rowToRecord(row: DataJudSearchRow): DataJudSearchHistoryRecord {
  return {
    id: row.id,
    court: row.court,
    queryType: row.query_type as DataJudSearchHistoryRecord['queryType'],
    queryValue: row.query_value,
    resultCount: row.result_count,
    responseData: row.response_data,
    createdAt: row.created_at,
    taskId: row.task_id,
  };
}

/**
 * Save a DataJud search to history
 *
 * @param query - The query that was executed
 * @param result - The search result
 * @param taskId - Optional task ID for association
 *
 * @returns The ID of the saved search record
 */
export function saveSearch(
  query: DataJudQuery,
  result: DataJudSearchResult,
  taskId?: string
): number {
  const db = getDatabase();

  const responseData = JSON.stringify(result);

  const resultDb = db
    .prepare(
      `INSERT INTO datajud_searches
        (court, query_type, query_value, result_count, response_data, created_at, task_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      query.court,
      query.queryType,
      query.value,
      result.processes.length,
      responseData,
      Math.floor(Date.now() / 1000),
      taskId || null
    );

  const insertId = Number(resultDb.lastInsertRowid);

  // Enforce max history limit
  enforceHistoryLimit(db);

  return insertId;
}

/**
 * Get a search by ID
 *
 * @param id - Search record ID
 * @returns The search record or undefined if not found
 */
export function getSearchById(id: number): DataJudSearchHistoryRecord | undefined {
  const db = getDatabase();

  const row = db
    .prepare('SELECT * FROM datajud_searches WHERE id = ?')
    .get(id) as DataJudSearchRow | undefined;

  return row ? rowToRecord(row) : undefined;
}

/**
 * Get recent searches with optional limit
 *
 * @param limit - Maximum number of searches to return (default: 50)
 * @returns Array of recent search records
 */
export function getRecentSearches(limit: number = 50): DataJudSearchHistoryRecord[] {
  const db = getDatabase();

  const rows = db
    .prepare('SELECT * FROM datajud_searches ORDER BY created_at DESC LIMIT ?')
    .all(limit) as DataJudSearchRow[];

  return rows.map(rowToRecord);
}

/**
 * Get searches by court
 *
 * @param court - Court alias to filter by
 * @param limit - Maximum number of searches to return
 * @returns Array of search records for the specified court
 */
export function getSearchesByCourt(
  court: string,
  limit: number = 50
): DataJudSearchHistoryRecord[] {
  const db = getDatabase();

  const rows = db
    .prepare('SELECT * FROM datajud_searches WHERE court = ? ORDER BY created_at DESC LIMIT ?')
    .all(court, limit) as DataJudSearchRow[];

  return rows.map(rowToRecord);
}

/**
 * Get searches by task ID
 *
 * @param taskId - Task ID to filter by
 * @returns Array of search records associated with the task
 */
export function getSearchesByTaskId(taskId: string): DataJudSearchHistoryRecord[] {
  const db = getDatabase();

  const rows = db
    .prepare('SELECT * FROM datajud_searches WHERE task_id = ? ORDER BY created_at DESC')
    .all(taskId) as DataJudSearchRow[];

  return rows.map(rowToRecord);
}

/**
 * Search history by value (substring match)
 *
 * @param value - Search value to match
 * @param limit - Maximum number of results
 * @returns Array of matching search records
 */
export function searchHistoryByValue(
  value: string,
  limit: number = 20
): DataJudSearchHistoryRecord[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      'SELECT * FROM datajud_searches WHERE query_value LIKE ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(`%${value}%`, limit) as DataJudSearchRow[];

  return rows.map(rowToRecord);
}

/**
 * Delete a search by ID
 *
 * @param id - Search record ID to delete
 * @returns true if deleted, false if not found
 */
export function deleteSearch(id: number): boolean {
  const db = getDatabase();

  const result = db.prepare('DELETE FROM datajud_searches WHERE id = ?').run(id);

  return result.changes > 0;
}

/**
 * Delete multiple searches by ID
 *
 * @param ids - Array of search record IDs to delete
 * @returns Number of deleted records
 */
export function deleteSearches(ids: number[]): number {
  if (ids.length === 0) return 0;

  const db = getDatabase();

  const placeholders = ids.map(() => '?').join(', ');
  const result = db
    .prepare(`DELETE FROM datajud_searches WHERE id IN (${placeholders})`)
    .run(...ids);

  return result.changes;
}

/**
 * Clear all search history
 */
export function clearHistory(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM datajud_searches').run();
  console.log('[DataJudRepository] Search history cleared');
}

/**
 * Clear searches older than a certain date
 *
 * @param daysOld - Delete searches older than this many days
 * @returns Number of deleted records
 */
export function clearOldSearches(daysOld: number = 30): number {
  const db = getDatabase();

  const cutoffTimestamp = Math.floor(Date.now() / 1000) - daysOld * 24 * 60 * 60;

  const result = db
    .prepare('DELETE FROM datajud_searches WHERE created_at < ?')
    .run(cutoffTimestamp);

  console.log(`[DataJudRepository] Cleared ${result.changes} searches older than ${daysOld} days`);

  return result.changes;
}

/**
 * Get search count by court
 *
 * @returns Array of counts per court
 */
export function getSearchCountByCourt(): Array<{ court: string; count: number }> {
  const db = getDatabase();

  const rows = db
    .prepare(
      'SELECT court, COUNT(*) as count FROM datajud_searches GROUP BY court ORDER BY count DESC'
    )
    .all() as Array<{ court: string; count: number }>;

  return rows;
}

/**
 * Get total search count
 *
 * @returns Total number of searches in history
 */
export function getTotalSearchCount(): number {
  const db = getDatabase();

  const result = db.prepare('SELECT COUNT(*) as count FROM datajud_searches').get() as {
    count: number;
  };

  return result.count;
}

/**
 * Get the cached response for a search (for cache lookup)
 *
 * @param query - Query to find cached response for
 * @returns Cached search result or undefined if not found or expired
 */
export function getCachedResponse(
  query: DataJudQuery
): DataJudSearchResult | undefined {
  const db = getDatabase();

  // Build a simple query to find matching search
  // Note: We only match on court, query_type, and query_value for cache lookup
  const row = db
    .prepare(
      `SELECT * FROM datajud_searches
       WHERE court = ? AND query_type = ? AND query_value = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(query.court, query.queryType, query.value) as DataJudSearchRow | undefined;

  if (!row || !row.response_data) {
    return undefined;
  }

  // Parse the cached response
  try {
    const cached = JSON.parse(row.response_data) as DataJudSearchResult;
    return cached;
  } catch {
    console.warn('[DataJudRepository] Failed to parse cached response');
    return undefined;
  }
}

/**
 * Enforce the maximum history limit by deleting oldest entries
 */
function enforceHistoryLimit(db: ReturnType<typeof getDatabase>): void {
  const countResult = db
    .prepare('SELECT COUNT(*) as count FROM datajud_searches')
    .get() as { count: number };

  if (countResult.count > MAX_HISTORY_ITEMS) {
    const deleteCount = countResult.count - MAX_HISTORY_ITEMS;
    db
      .prepare(
        `DELETE FROM datajud_searches
         WHERE id IN (
           SELECT id FROM datajud_searches
           ORDER BY created_at ASC
           LIMIT ?
         )`
      )
      .run(deleteCount);

    console.log(`[DataJudRepository] Enforced history limit, deleted ${deleteCount} old entries`);
  }
}

/**
 * Get history statistics for debugging
 */
export function getHistoryStats(): {
  totalSearches: number;
  searchesByCourt: Array<{ court: string; count: number }>;
  oldestSearch: number | null;
  newestSearch: number | null;
} {
  const db = getDatabase();

  const totalResult = db
    .prepare('SELECT COUNT(*) as count FROM datajud_searches')
    .get() as { count: number };

  const courtResult = db
    .prepare(
      'SELECT court, COUNT(*) as count FROM datajud_searches GROUP BY court ORDER BY count DESC'
    )
    .all() as Array<{ court: string; count: number }>;

  const oldestResult = db
    .prepare('SELECT MIN(created_at) as min FROM datajud_searches')
    .get() as { min: number | null };

  const newestResult = db
    .prepare('SELECT MAX(created_at) as max FROM datajud_searches')
    .get() as { max: number | null };

  return {
    totalSearches: totalResult.count,
    searchesByCourt: courtResult,
    oldestSearch: oldestResult.min,
    newestSearch: newestResult.max,
  };
}
