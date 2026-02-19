/**
 * @component LogsSettings
 * @description Accordion-style list of token usage logs grouped by task.
 * Each task group expands to show individual steps with model, tokens, and cost.
 * Supports filtering by provider and CSV export.
 *
 * @context Settings Dialog > Logs tab
 *
 * @dependencies
 * - hooks/useApiLogs.ts (useApiLogs, TaskLogGroup, LogStep)
 *
 * @relatedFiles
 * - components/layout/SettingsDialog.tsx (parent that renders this tab)
 * - main/ipc/token-usage-handlers.ts (IPC backend)
 *
 * @stateManagement
 * - useApiLogs: fetches and groups log data
 * - useState: expandedTaskId, selectedProvider
 *
 * AIDEV-WARNING: Depends on token_usage table (migration v007) existing
 * AIDEV-NOTE: No external libs - uses native <select> and Blob for CSV export
 */

import { useState, useMemo, useCallback } from 'react';
import { useApiLogs } from '@/hooks/useApiLogs';
import type { TaskLogGroup, LogStep } from '@/hooks/useApiLogs';

// ─── Source badge colors ─────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  primary: 'bg-zinc-600 text-zinc-100',
  retry: 'bg-yellow-600 text-yellow-100',
  fallback: 'bg-orange-600 text-orange-100',
  continuation: 'bg-blue-600 text-blue-100',
  summarization: 'bg-purple-600 text-purple-100',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(cost: number | null): string {
  if (cost == null || cost === 0) return '-';
  return `$${cost.toFixed(4)}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(s: string | null, max: number): string {
  if (!s) return '(sem prompt)';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

function exportCsv(groups: TaskLogGroup[]) {
  const header =
    'Task ID,Prompt,Status,Step #,Source,Model,Provider,Input Tokens,Output Tokens,Reasoning Tokens,Cache Read,Cache Write,Cost USD,Estimated,Created At\n';
  const rows = groups.flatMap((g) =>
    g.steps.map(
      (s) =>
        [
          s.taskId,
          `"${(s.taskPrompt ?? '').replace(/"/g, '""')}"`,
          s.taskStatus ?? '',
          s.stepNumber ?? '',
          s.source,
          s.modelId,
          s.provider,
          s.inputTokens,
          s.outputTokens,
          s.reasoningTokens,
          s.cacheReadTokens,
          s.cacheWriteTokens,
          s.costUsd ?? '',
          s.isEstimated ? 'yes' : 'no',
          s.createdAt,
        ].join(',')
    )
  );
  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `token-usage-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LogsSettings() {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const { taskGroups, providers, isLoading, error, refetch } = useApiLogs({
    limit: 200,
    provider: selectedProvider || undefined,
  });

  const toggle = useCallback(
    (taskId: string) => {
      setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
    },
    []
  );

  // Memoize for CSV export
  const filteredGroups = useMemo(() => taskGroups, [taskGroups]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Erro ao carregar logs: {error}
        <button onClick={refetch} className="ml-2 underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter + export */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">
          Logs de Uso de Tokens
        </h3>
        <div className="flex items-center gap-2">
          {providers.length > 1 && (
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
            >
              <option value="">Todos providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => exportCsv(filteredGroups)}
            disabled={filteredGroups.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* Task list (accordion) */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum log de uso encontrado.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
          {filteredGroups.map((group) => (
            <TaskAccordionItem
              key={group.taskId}
              group={group}
              expanded={expandedTaskId === group.taskId}
              onToggle={() => toggle(group.taskId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Accordion Item ──────────────────────────────────────────────────────────

function TaskAccordionItem({
  group,
  expanded,
  onToggle,
}: {
  group: TaskLogGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {/* Chevron */}
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Prompt (truncated) */}
        <span className="flex-1 truncate text-xs text-foreground">
          {truncate(group.taskPrompt, 60)}
        </span>

        {/* Meta info */}
        <span className="flex-shrink-0 text-[10px] text-muted-foreground">
          {formatTime(group.createdAt)}
        </span>
        <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {group.providers.join(', ')}
        </span>
        <span className="flex-shrink-0 text-[10px] text-muted-foreground">
          {group.steps.length} step{group.steps.length !== 1 ? 's' : ''}
        </span>
        <span className="flex-shrink-0 text-[10px] font-medium text-foreground min-w-[50px] text-right">
          {formatCost(group.totalCostUsd)}
          {group.isEstimated && <span className="text-yellow-500">~</span>}
        </span>
      </button>

      {/* Expanded detail table */}
      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Source</th>
                <th className="px-2 py-1.5 text-left font-medium">Modelo</th>
                <th className="px-2 py-1.5 text-right font-medium">Input</th>
                <th className="px-2 py-1.5 text-right font-medium">Output</th>
                <th className="px-2 py-1.5 text-right font-medium">Cache</th>
                <th className="px-3 py-1.5 text-right font-medium">Custo</th>
              </tr>
            </thead>
            <tbody>
              {group.steps.map((step, i) => (
                <StepRow key={step.id} step={step} index={i + 1} />
              ))}
              {/* Totals row */}
              <tr className="border-t border-border bg-muted/30 font-medium text-foreground">
                <td className="px-3 py-1.5" colSpan={3}>
                  Total
                </td>
                <td className="px-2 py-1.5 text-right">
                  {formatNumber(group.totalInputTokens)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {formatNumber(group.totalOutputTokens)}
                </td>
                <td className="px-2 py-1.5 text-right">-</td>
                <td className="px-3 py-1.5 text-right">
                  {formatCost(group.totalCostUsd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Step Row ────────────────────────────────────────────────────────────────

function StepRow({ step, index }: { step: LogStep; index: number }) {
  const cacheTotal = step.cacheReadTokens + step.cacheWriteTokens;
  const badgeClass = SOURCE_COLORS[step.source] ?? SOURCE_COLORS.primary;

  return (
    <tr className="border-b border-border/50 text-foreground hover:bg-muted/20">
      <td className="px-3 py-1.5 text-muted-foreground">{index}</td>
      <td className="px-2 py-1.5">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
          {step.source}
        </span>
      </td>
      <td className="px-2 py-1.5 max-w-[120px] truncate" title={step.modelId}>
        {step.modelId}
      </td>
      <td className="px-2 py-1.5 text-right">{formatNumber(step.inputTokens)}</td>
      <td className="px-2 py-1.5 text-right">{formatNumber(step.outputTokens)}</td>
      <td className="px-2 py-1.5 text-right text-muted-foreground">
        {cacheTotal > 0 ? formatNumber(cacheTotal) : '-'}
      </td>
      <td className="px-3 py-1.5 text-right">
        {formatCost(step.costUsd)}
        {step.isEstimated === 1 && <span className="text-yellow-500">~</span>}
      </td>
    </tr>
  );
}
