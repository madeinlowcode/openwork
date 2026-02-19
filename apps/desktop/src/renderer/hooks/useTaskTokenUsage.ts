/**
 * @hook useTaskTokenUsage
 * @description Busca resumo de uso de tokens para uma tarefa especifica via IPC.
 *              So executa a busca quando a tarefa esta em status terminal.
 *
 * @param taskId - ID da tarefa a buscar
 * @param status - Status atual da tarefa
 * @returns { summary, isLoading, error }
 *
 * @dependencies
 * - react (useState, useEffect)
 *
 * @usedBy
 * - components/TaskCostBanner.tsx
 *
 * AIDEV-NOTE: So busca tokens em status terminais para evitar requests desnecessarios
 * AIDEV-WARNING: window.jurisiar.tokenUsage pode ser undefined fora do Electron
 */
import { useState, useEffect } from 'react';
import type { TaskStatus } from '@accomplish/shared';

interface TokenSummary {
  taskId: string;
  sessionId: string | null;
  modelId: string | null;
  provider: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
  isEstimated: number;
  stepCount: number;
}

const TERMINAL_STATUSES: TaskStatus[] = ['completed', 'failed', 'cancelled', 'interrupted'];

export function useTaskTokenUsage(taskId: string | null, status: TaskStatus | null) {
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !status || !TERMINAL_STATUSES.includes(status)) {
      setSummary(null);
      return;
    }

    const api = (window as any).jurisiar?.tokenUsage;
    if (!api) return;

    setIsLoading(true);
    setError(null);

    api.getSummary(taskId)
      .then((data: TokenSummary | null) => {
        setSummary(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load token usage');
      })
      .finally(() => setIsLoading(false));
  }, [taskId, status]);

  return { summary, isLoading, error };
}
