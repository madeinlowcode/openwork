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
import { getSignedHeaders } from '../lib/request-signer';

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
      // AIDEV-NOTE: Estrutura do session do better-auth - usa type assertion
      const sessionData = session.data as { session?: { token?: string }; accessToken?: string };
      const token = sessionData.session?.token || sessionData.accessToken;
      if (!token) return;
      const bodyStr = JSON.stringify(data);
      fetch(`${WORKER_URL}/usage/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // AIDEV-SECURITY: Authorization header obrigatório para validar sessão no worker
          Authorization: `Bearer ${token}`,
          // AIDEV-SECURITY: HMAC signing para validacao de integridade no Worker
          ...getSignedHeaders(bodyStr),
        },
        body: bodyStr,
      }).catch(() => {
        // AIDEV-NOTE: Silenciar erros de rede — fire-and-forget
      });
    })
    .catch(() => {
      // AIDEV-NOTE: Silenciar erros de sessao — usuario pode nao estar autenticado
    });
}
