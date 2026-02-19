// apps/desktop/src/main/ipc/token-usage-handlers.ts

/**
 * @description IPC handlers for token usage tracking queries.
 * Exposes read-only access to token usage data for the renderer process.
 *
 * @context Main process handlers for token usage analytics
 *
 * @dependencies
 * - apps/desktop/src/main/store/repositories/tokenUsage.ts (data layer)
 *
 * @usedBy
 * - apps/desktop/src/main/ipc/handlers.ts (registered via registerTokenUsageHandlers)
 * - apps/desktop/src/preload/index.ts (exposed to renderer)
 *
 * AIDEV-NOTE: Read-only handlers - no mutations exposed to renderer
 * AIDEV-WARNING: Validate all input parameters before querying
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import {
  getByTaskId,
  getSummaryByTask,
  getDailySummary,
} from '../store/repositories/tokenUsage';
import { getDatabase } from '../store/db';

/**
 * @function registerTokenUsageHandlers
 * @description Registers all token-usage IPC handlers
 *
 * @usedBy
 * - apps/desktop/src/main/ipc/handlers.ts (registerIPCHandlers)
 */
export function registerTokenUsageHandlers(): void {
  // ─── Get usage records by task ID ────────────────────────────────────────────
  ipcMain.handle(
    'token-usage:get-by-task',
    async (_event: IpcMainInvokeEvent, taskId: string) => {
      if (!taskId || typeof taskId !== 'string') {
        return [];
      }
      return getByTaskId(taskId);
    }
  );

  // ─── Get aggregated summary for a task ───────────────────────────────────────
  ipcMain.handle(
    'token-usage:get-summary',
    async (_event: IpcMainInvokeEvent, taskId: string) => {
      if (!taskId || typeof taskId !== 'string') {
        return null;
      }
      return getSummaryByTask(taskId);
    }
  );

  // ─── Get daily usage summary ─────────────────────────────────────────────────
  ipcMain.handle(
    'token-usage:get-daily-summary',
    async (_event: IpcMainInvokeEvent, days: number) => {
      const safeDays = typeof days === 'number' && days > 0 ? Math.min(days, 365) : 30;
      return getDailySummary(safeDays);
    }
  );

  // ─── Get logs with task info (JOIN token_usage + tasks) ─────────────────────
  // AIDEV-NOTE: Used by LogsSettings tab to display token usage logs grouped by task
  // AIDEV-WARNING: Returns raw rows - grouping by task_id is done client-side
  ipcMain.handle(
    'token-usage:get-logs',
    async (
      _event: IpcMainInvokeEvent,
      options?: { limit?: number; provider?: string }
    ) => {
      const db = getDatabase();
      const limit = options?.limit ?? 200;
      const provider = options?.provider;

      // AIDEV-NOTE: Use camelCase aliases so the renderer hook can access fields directly
      // SQLite returns snake_case by default; aliases avoid mapping in the client
      let sql = `
        SELECT
          tu.id,
          tu.task_id       AS taskId,
          tu.session_id    AS sessionId,
          tu.model_id      AS modelId,
          tu.provider,
          tu.source,
          tu.step_number   AS stepNumber,
          tu.input_tokens  AS inputTokens,
          tu.output_tokens AS outputTokens,
          tu.reasoning_tokens  AS reasoningTokens,
          tu.cache_read_tokens  AS cacheReadTokens,
          tu.cache_write_tokens AS cacheWriteTokens,
          tu.cost_usd      AS costUsd,
          tu.is_estimated  AS isEstimated,
          tu.created_at    AS createdAt,
          t.prompt         AS taskPrompt,
          t.status         AS taskStatus
        FROM token_usage tu
        LEFT JOIN tasks t ON t.id = tu.task_id
      `;

      const params: unknown[] = [];
      if (provider) {
        sql += ` WHERE tu.provider = ?`;
        params.push(provider);
      }
      sql += ` ORDER BY tu.created_at DESC LIMIT ?`;
      params.push(limit);

      return db.prepare(sql).all(...params);
    }
  );
}
