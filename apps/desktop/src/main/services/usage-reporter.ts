/**
 * @module usage-reporter
 * @description Envia dados de uso de tokens para o PostgreSQL via Cloudflare Worker.
 * Fire-and-forget: nao bloqueia o fluxo principal e ignora erros silenciosamente.
 *
 * @dependencies
 * - src/main/lib/auth-client.ts (authClient, WORKER_URL)
 *
 * @relatedFiles
 * - src/main/opencode/adapter.ts (chama reportUsageAsync ao finalizar task)
 * - cloudflare-workers/auth-worker/src/index.ts (endpoint /usage/record)
 *
 * @usedBy
 * - src/main/opencode/adapter.ts
 *
 * AIDEV-NOTE: Fire-and-forget — nao bloqueia fluxo principal
 * AIDEV-WARNING: So envia dados se usuario estiver autenticado via Better Auth
 */

import { authClient, WORKER_URL } from '../lib/auth-client';

export interface UsageReportData {
  taskId: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

/**
 * @function reportUsageAsync
 * @description Envia dados de uso de tokens ao servidor de forma assincrona (fire-and-forget).
 * So envia se o usuario estiver autenticado.
 *
 * @param {UsageReportData} data - Dados de uso da task
 * @returns {void} Nao retorna nada — fire-and-forget
 *
 * AIDEV-NOTE: Erros sao silenciados — uso de tokens e best-effort, nao critico
 */
export function reportUsageAsync(data: UsageReportData): void {
  authClient
    .getSession()
    .then((session) => {
      if (!session?.data) return;
      fetch(`${WORKER_URL}/usage/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {
        // AIDEV-NOTE: Silenciar erros de rede — fire-and-forget
      });
    })
    .catch(() => {
      // AIDEV-NOTE: Silenciar erros de sessao — usuario pode nao estar autenticado
    });
}
