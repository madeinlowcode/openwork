/**
 * @component UsageSettings
 * @description Aba de configuracoes mostrando historico de uso de tokens e custos.
 *              Exibe 3 cards de resumo semanal + lista de uso diario com barras de progresso.
 *
 * @context Settings Dialog — aba "Uso" (usage)
 *
 * @dependencies
 * - hooks/useUsageStats.ts (useUsageStats)
 *
 * @relatedFiles
 * - components/layout/SettingsDialog.tsx (integracao da aba)
 * - main/store/repositories/tokenUsage.ts (fonte de dados)
 *
 * AIDEV-NOTE: Barras de progresso com max = valor maximo do periodo (nao soma)
 * AIDEV-WARNING: Nao renderiza dados se tokenUsage IPC nao estiver disponivel
 */
import { useUsageStats } from '@/hooks/useUsageStats';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-mono tabular-nums font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '< $0.001';
  return `$${usd.toFixed(3)}`;
}

export function UsageSettings() {
  const { dailyData, weekTotal, isLoading, error } = useUsageStats(30);

  const isAvailable = !!(window as any).jurisiar?.tokenUsage;

  if (!isAvailable) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Dados de uso nao disponiveis
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-destructive">
        {error}
      </div>
    );
  }

  // Calcular max para barras de progresso
  const maxCost = Math.max(...dailyData.map(r => r.totalCostUsd ?? 0), 0.001);

  const totalTokens = weekTotal.inputTokens + weekTotal.outputTokens;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Uso de Tokens</h3>
        <p className="text-sm text-muted-foreground mt-1">Resumo dos ultimos 7 dias</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Custo (7 dias)"
          value={formatCost(weekTotal.cost)}
          sub={dailyData.length > 0 ? `${dailyData.length} dias registrados` : undefined}
        />
        <StatCard
          label="Tokens (7 dias)"
          value={formatK(totalTokens)}
          sub={`\u2191${formatK(weekTotal.inputTokens)} \u2193${formatK(weekTotal.outputTokens)}`}
        />
        <StatCard
          label="Tarefas (7 dias)"
          value={String(weekTotal.tasks)}
        />
      </div>

      {/* Historico diario */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Historico (30 dias)</h4>
        {dailyData.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-lg">
            Nenhum dado ainda. Execute uma tarefa para ver o uso.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {dailyData.slice().reverse().map((row) => {
              const cost = row.totalCostUsd ?? 0;
              const barWidth = maxCost > 0 ? Math.round((cost / maxCost) * 100) : 0;
              return (
                <div key={row.date} className="flex items-center gap-3 group">
                  <span className="text-xs text-muted-foreground font-mono w-24 shrink-0">
                    {row.date}
                  </span>
                  <div className="flex-1 h-[3px] bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground/30 rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground w-20 text-right shrink-0">
                    {formatCost(cost)}
                  </span>
                  <span className="text-xs text-muted-foreground/60 w-16 text-right shrink-0">
                    {row.taskCount} tarefa{row.taskCount !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UsageSettings;
