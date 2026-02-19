/**
 * @component TaskCostBanner
 * @description Banner compacto que exibe o custo e tokens consumidos ao final de uma tarefa.
 *              Aparece apenas quando a tarefa esta em status terminal e ha dados de token.
 *
 * @context Execution page — abaixo da ultima mensagem quando tarefa completa
 *
 * @dependencies
 * - hooks/useTaskTokenUsage.ts (useTaskTokenUsage)
 *
 * @relatedFiles
 * - pages/Execution.tsx (local de integracao)
 * - main/store/repositories/tokenUsage.ts (fonte de dados)
 *
 * @props
 * - taskId: string — ID da tarefa
 * - status: TaskStatus — status atual
 *
 * AIDEV-NOTE: Usa monospace para numeros (tabular-nums), prefixo ~ para estimativas
 * AIDEV-WARNING: Nao renderiza nada se summary for null ou isLoading for true
 */
import type { TaskStatus } from '@accomplish/shared';
import { useTaskTokenUsage } from '@/hooks/useTaskTokenUsage';

interface TaskCostBannerProps {
  taskId: string;
  status: TaskStatus;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number | null, estimated: boolean): string {
  if (usd === null) return '\u2014';
  const prefix = estimated ? '~' : '';
  if (usd < 0.001) return `${prefix}< $0.001`;
  return `${prefix}$${usd.toFixed(4)}`;
}

export function TaskCostBanner({ taskId, status }: TaskCostBannerProps) {
  const { summary, isLoading } = useTaskTokenUsage(taskId, status);

  if (isLoading || !summary) return null;

  const isEstimated = Boolean(summary.isEstimated);
  const modelLabel = summary.modelId
    ? summary.modelId.split('/').pop() ?? summary.modelId
    : summary.provider ?? 'unknown';

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
      <span className="font-medium truncate max-w-[200px]">{modelLabel}</span>
      <span className="font-mono tabular-nums flex gap-3 shrink-0">
        <span title="Input tokens">{'\u2191'}{formatTokens(summary.totalInputTokens)}</span>
        <span title="Output tokens">{'\u2193'}{formatTokens(summary.totalOutputTokens)}</span>
        <span className="text-foreground font-medium" title={isEstimated ? 'Custo estimado' : 'Custo real'}>
          {formatCost(summary.totalCostUsd, isEstimated)}
        </span>
      </span>
    </div>
  );
}

export default TaskCostBanner;
