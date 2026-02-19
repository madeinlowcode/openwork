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
}
