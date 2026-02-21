/**
 * @component UsageMeter
 * @description Exibe uso atual do plano do usuario (tasks usadas/limite) com barra de progresso.
 * Mostra aviso visual quando proximo do limite (>80%) e CTA de upgrade quando no limite.
 *
 * @dependencies
 * - lib/jurisiar.ts (user.getUsage)
 * - lucide-react (Activity, AlertTriangle)
 *
 * @relatedFiles
 * - src/main/ipc/handlers.ts (handler user:get-usage)
 * - src/preload/index.ts (user.getUsage method)
 * - pages/Home.tsx (integrado na pagina principal)
 *
 * @stateManagement
 * - useState: usage data, loading, error
 *
 * AIDEV-NOTE: Busca dados do Worker /api/user/usage via IPC
 * AIDEV-WARNING: Retorna null silenciosamente se usuario nao autenticado
 */

import { useState, useEffect } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { getJurisiar, isRunningInElectron } from '@/lib/jurisiar';

interface UsageData {
  plan: string;
  tasksUsed: number;
  tasksLimit: number;
  tokensUsed: number;
  tokensLimit: number;
}

export function UsageMeter() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isRunningInElectron()) {
      setLoading(false);
      return;
    }

    const fetchUsage = async () => {
      try {
        const jurisiar = getJurisiar();
        const data = await (jurisiar as any).user?.getUsage();
        if (data) {
          setUsage(data as UsageData);
        }
      } catch {
        // AIDEV-NOTE: Silenciar erros — componente e informativo, nao critico
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading || !usage) return null;

  const taskPercent = usage.tasksLimit > 0
    ? Math.min(100, Math.round((usage.tasksUsed / usage.tasksLimit) * 100))
    : 0;
  const isWarning = taskPercent >= 80;
  const isAtLimit = taskPercent >= 100;

  const barColor = isAtLimit
    ? 'bg-red-500'
    : isWarning
      ? 'bg-yellow-500'
      : 'bg-primary';

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="h-4 w-4" />
          <span>{usage.plan}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {usage.tasksUsed}/{usage.tasksLimit} tasks
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${taskPercent}%` }}
        />
      </div>

      {isWarning && !isAtLimit && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{taskPercent}% do limite utilizado</span>
        </div>
      )}

      {isAtLimit && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Limite atingido. Considere fazer upgrade do plano.</span>
        </div>
      )}
    </div>
  );
}

export default UsageMeter;
