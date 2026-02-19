/**
 * @hook useUsageStats
 * @description Busca resumo diario de uso de tokens dos ultimos N dias via IPC.
 *              Calcula totais da semana e historico diario formatado.
 *
 * @param days - Numero de dias para buscar (padrao: 30)
 * @returns { dailyData, weekTotal, isLoading, error, refetch }
 *
 * @dependencies
 * - react (useState, useEffect, useCallback)
 *
 * @usedBy
 * - components/settings/UsageSettings.tsx
 *
 * AIDEV-WARNING: window.jurisiar.tokenUsage pode ser undefined fora do Electron
 */
import { useState, useEffect, useCallback } from 'react';

interface DailyRow {
  date: string;
  taskCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
}

interface WeekTotal {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  tasks: number;
}

export function useUsageStats(days = 30) {
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [weekTotal, setWeekTotal] = useState<WeekTotal>({ cost: 0, inputTokens: 0, outputTokens: 0, tasks: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const api = (window as any).jurisiar?.tokenUsage;
    if (!api) return;

    setIsLoading(true);
    setError(null);

    try {
      const rows: DailyRow[] = await api.getDailySummary(days);
      setDailyData(rows);

      // Semana = ultimos 7 dias
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const week = rows.filter(r => r.date >= cutoffStr).reduce(
        (acc, r) => ({
          cost: acc.cost + (r.totalCostUsd ?? 0),
          inputTokens: acc.inputTokens + r.totalInputTokens,
          outputTokens: acc.outputTokens + r.totalOutputTokens,
          tasks: acc.tasks + r.taskCount,
        }),
        { cost: 0, inputTokens: 0, outputTokens: 0, tasks: 0 }
      );
      setWeekTotal(week);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { dailyData, weekTotal, isLoading, error, refetch: fetchData };
}
