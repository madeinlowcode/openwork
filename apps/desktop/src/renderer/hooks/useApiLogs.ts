/**
 * @hook useApiLogs
 * @description Fetches token usage logs via IPC and groups rows by task_id client-side.
 * Returns task groups sorted by newest first, plus a unique provider list for filtering.
 *
 * @returns {Object}
 * @returns {TaskLogGroup[]} taskGroups - Logs grouped by task, newest first
 * @returns {string[]} providers - Unique provider names found in results
 * @returns {boolean} isLoading - Whether data is being fetched
 * @returns {string | null} error - Error message if fetch failed
 * @returns {() => void} refetch - Manually trigger a re-fetch
 *
 * @dependencies
 * - apps/desktop/src/renderer/lib/jurisiar.ts (window.jurisiar.tokenUsage.getLogs)
 * - apps/desktop/src/main/ipc/token-usage-handlers.ts (token-usage:get-logs)
 *
 * @usedBy
 * - apps/desktop/src/renderer/components/settings/LogsSettings.tsx
 *
 * AIDEV-WARNING: Depends on token_usage table existing (migration v007)
 * AIDEV-NOTE: Grouping is done client-side to keep the SQL query simple
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogStep {
  id: string;
  taskId: string;
  sessionId: string | null;
  modelId: string;
  provider: string;
  source: 'primary' | 'retry' | 'fallback' | 'continuation' | 'summarization';
  stepNumber: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
  isEstimated: number;
  createdAt: string;
  taskPrompt: string | null;
  taskStatus: string | null;
}

export interface TaskLogGroup {
  taskId: string;
  taskPrompt: string | null;
  taskStatus: string | null;
  createdAt: string;
  steps: LogStep[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  providers: string[];
  isEstimated: boolean;
}

// ─── Row → LogStep mapper ────────────────────────────────────────────────────

function rowToStep(row: Record<string, unknown>): LogStep {
  return {
    id: String(row.id ?? ''),
    taskId: String(row.task_id ?? ''),
    sessionId: row.session_id != null ? String(row.session_id) : null,
    modelId: String(row.model_id ?? ''),
    provider: String(row.provider ?? ''),
    source: (row.source as LogStep['source']) ?? 'primary',
    stepNumber: row.step_number != null ? Number(row.step_number) : null,
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
    reasoningTokens: Number(row.reasoning_tokens ?? 0),
    cacheReadTokens: Number(row.cache_read_tokens ?? 0),
    cacheWriteTokens: Number(row.cache_write_tokens ?? 0),
    costUsd: row.cost_usd != null ? Number(row.cost_usd) : null,
    isEstimated: Number(row.is_estimated ?? 0),
    createdAt: String(row.created_at ?? ''),
    taskPrompt: row.task_prompt != null ? String(row.task_prompt) : null,
    taskStatus: row.task_status != null ? String(row.task_status) : null,
  };
}

// ─── Group steps by task_id ──────────────────────────────────────────────────

function groupByTask(steps: LogStep[]): TaskLogGroup[] {
  const map = new Map<string, LogStep[]>();

  for (const step of steps) {
    const key = step.taskId || '__no_task__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(step);
  }

  const groups: TaskLogGroup[] = [];
  for (const [taskId, taskSteps] of map) {
    // Sort steps within group by createdAt ascending (oldest first)
    taskSteps.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const totalInputTokens = taskSteps.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutputTokens = taskSteps.reduce((s, r) => s + r.outputTokens, 0);
    const totalCostUsd = taskSteps.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    const providers = [...new Set(taskSteps.map((r) => r.provider))];
    const isEstimated = taskSteps.some((r) => r.isEstimated === 1);

    groups.push({
      taskId,
      taskPrompt: taskSteps[0]?.taskPrompt ?? null,
      taskStatus: taskSteps[0]?.taskStatus ?? null,
      createdAt: taskSteps[0]?.createdAt ?? '',
      steps: taskSteps,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      providers,
      isEstimated,
    });
  }

  // Sort groups by newest first (based on first step's createdAt)
  groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return groups;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApiLogs(options?: { limit?: number; provider?: string }) {
  const [taskGroups, setTaskGroups] = useState<TaskLogGroup[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const api = (window as any).jurisiar?.tokenUsage;
      if (!api?.getLogs) {
        setTaskGroups([]);
        setProviders([]);
        return;
      }

      const rows = (await api.getLogs({
        limit: options?.limit,
        provider: options?.provider,
      })) as Record<string, unknown>[];

      const steps = rows.map(rowToStep);
      const allProviders = [...new Set(steps.map((s) => s.provider))].sort();
      const groups = groupByTask(steps);

      setTaskGroups(groups);
      setProviders(allProviders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setTaskGroups([]);
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  }, [options?.limit, options?.provider]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { taskGroups, providers, isLoading, error, refetch: fetchLogs };
}
