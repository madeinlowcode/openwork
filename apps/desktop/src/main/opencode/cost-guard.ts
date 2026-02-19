/**
 * @component CostGuard
 * @description Circuit breaker financeiro por task. Acumula custos e bloqueia
 * execucao quando o limite de gastos e atingido. Emite warning ao atingir
 * percentual configuravel (default 80%).
 *
 * @context OpenCode adapter - chamado a cada step_finish com custo reportado
 *
 * @dependencies
 * - Nenhuma dependencia externa (TypeScript puro)
 *
 * @usedBy
 * - main/opencode/adapter.ts (integracao futura)
 *
 * @stateManagement
 * - accumulated: custo acumulado em USD na task atual
 * - limitReached: flag sticky - uma vez true, nao volta a false sem reset()
 * - warningEmitted: evita emitir warning multiplas vezes
 *
 * ⚠️ AIDEV-WARNING: Circuit breaker financeiro - nao desabilitar sem aprovacao
 * ⚠️ AIDEV-WARNING: Alteracoes aqui impactam diretamente o controle de gastos do usuario
 * 🔒 AIDEV-SECURITY: Limites devem ser respeitados mesmo em cenarios de fallback/retry
 */

/**
 * @function CostGuardConfig
 * @description Configuracao do circuit breaker de custo
 */
export interface CostGuardConfig {
  /** Limite maximo de custo em USD para a task */
  maxCostUsd: number;
  /** Callback invocado quando o limite e atingido */
  onLimitReached: (accumulated: number, max: number) => void;
  /** Percentual do limite que dispara warning (default 80) */
  warnAtPercentage?: number;
  /** Callback invocado quando o percentual de warning e atingido */
  onWarning?: (accumulated: number, max: number) => void;
}

/**
 * Default limits por plano de uso.
 *
 * ⚠️ AIDEV-WARNING: Alterar estes valores impacta todos os usuarios do plano
 */
export const DEFAULT_COST_LIMITS = {
  free: 0.50,
  pro: 5.00,
  business: 20.00,
} as const;

export class CostGuard {
  private accumulated: number = 0;
  private limitReached: boolean = false;
  private warningEmitted: boolean = false;
  private readonly maxCostUsd: number;
  private readonly warnAtPercentage: number;
  private readonly onLimitReached: CostGuardConfig['onLimitReached'];
  private readonly onWarning: CostGuardConfig['onWarning'];

  constructor(config: CostGuardConfig) {
    this.maxCostUsd = config.maxCostUsd;
    this.onLimitReached = config.onLimitReached;
    this.warnAtPercentage = config.warnAtPercentage ?? 80;
    this.onWarning = config.onWarning;
  }

  /**
   * Adiciona custo acumulado. Retorna false se o limite foi atingido.
   *
   * ⚠️ AIDEV-WARNING: Uma vez que retorna false, todas as chamadas subsequentes
   * tambem retornam false ate que reset() seja chamado.
   */
  addCost(costUsd: number): boolean {
    if (this.limitReached) {
      return false;
    }

    this.accumulated += costUsd;

    // AIDEV-NOTE: Checa warning antes do limite para garantir que ambos
    // callbacks sejam disparados na mesma chamada se necessario
    if (
      !this.warningEmitted &&
      this.onWarning &&
      this.getUsagePercentage() >= this.warnAtPercentage
    ) {
      this.warningEmitted = true;
      this.onWarning(this.accumulated, this.maxCostUsd);
    }

    if (this.accumulated >= this.maxCostUsd) {
      this.limitReached = true;
      this.onLimitReached(this.accumulated, this.maxCostUsd);
      return false;
    }

    return true;
  }

  /**
   * Verifica se um gasto estimado caberia no budget restante.
   */
  canSpend(estimatedCost: number): boolean {
    if (this.limitReached) {
      return false;
    }
    return (this.accumulated + estimatedCost) <= this.maxCostUsd;
  }

  getAccumulated(): number {
    return this.accumulated;
  }

  getMaxCost(): number {
    return this.maxCostUsd;
  }

  getRemainingBudget(): number {
    return Math.max(0, this.maxCostUsd - this.accumulated);
  }

  getUsagePercentage(): number {
    if (this.maxCostUsd === 0) {
      return this.accumulated > 0 ? 100 : 0;
    }
    return (this.accumulated / this.maxCostUsd) * 100;
  }

  isLimitReached(): boolean {
    return this.limitReached;
  }

  /**
   * Reseta o estado para uma nova task.
   * AIDEV-NOTE: Deve ser chamado no inicio de cada task, nao entre retries.
   */
  reset(): void {
    this.accumulated = 0;
    this.limitReached = false;
    this.warningEmitted = false;
  }
}
