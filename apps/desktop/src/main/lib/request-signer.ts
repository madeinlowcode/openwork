/**
 * @module request-signer
 * @description Assina requests HTTP com HMAC-SHA256 para validacao no Cloudflare Worker.
 * O Worker usa verifyHmacSignature para verificar a assinatura.
 *
 * @dependencies
 * - crypto (Node.js built-in)
 *
 * @relatedFiles
 * - src/main/services/usage-reporter.ts (adiciona headers HMAC ao fetch)
 * - src/main/opencode/adapter.ts (adiciona headers HMAC ao /api/task/authorize)
 * - cloudflare-workers/auth-worker/src/index.ts (verifyHmacSignature server-side)
 *
 * @usedBy
 * - src/main/services/usage-reporter.ts
 * - src/main/opencode/adapter.ts
 *
 * AIDEV-SECURITY: Chave de assinatura deve ser configurada via variavel de ambiente em producao
 * AIDEV-WARNING: Manter em sincronia com verifyHmacSignature no Worker
 */

import crypto from 'crypto';

// AIDEV-SECURITY: Em producao, usar variavel de ambiente para a chave
const APP_SIGNING_KEY = process.env.APP_SIGNING_KEY ?? 'openwork-desktop-v1';

/**
 * @function signRequest
 * @description Gera assinatura HMAC-SHA256 para um body + timestamp.
 *
 * @param {string} body - Body da request como string
 * @param {number} timestamp - Unix timestamp em ms
 * @returns {string} Hex-encoded HMAC-SHA256 signature
 */
export function signRequest(body: string, timestamp: number): string {
  const payload = `${timestamp}:${body}`;
  return crypto.createHmac('sha256', APP_SIGNING_KEY).update(payload).digest('hex');
}

/**
 * @function getSignedHeaders
 * @description Retorna os headers de assinatura HMAC para adicionar a um fetch request.
 *
 * @param {string} body - Body da request como string JSON
 * @returns {Record<string, string>} Headers X-App-Signature e X-App-Timestamp
 */
export function getSignedHeaders(body: string): Record<string, string> {
  const timestamp = Date.now();
  const signature = signRequest(body, timestamp);
  return {
    'X-App-Signature': signature,
    'X-App-Timestamp': String(timestamp),
  };
}
