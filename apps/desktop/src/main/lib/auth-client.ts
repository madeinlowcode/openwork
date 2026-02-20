/**
 * @module auth-client
 * @description Cliente Better Auth para o processo main do Electron.
 * Gerencia autenticacao via Cloudflare Worker usando o plugin oficial @better-auth/electron.
 *
 * @dependencies
 * - better-auth/client (createAuthClient)
 * - @better-auth/electron/client (electronClient)
 *
 * @relatedFiles
 * - src/main/index.ts (chama setupMain)
 * - src/main/ipc/handlers.ts (handlers de auth)
 * - cloudflare-workers/auth-worker/src/index.ts (servidor Better Auth)
 *
 * AIDEV-WARNING: WORKER_URL deve ser atualizado com a URL real apos deploy do Worker
 * AIDEV-SECURITY: Tokens sao gerenciados internamente pelo plugin — nunca expostos ao renderer
 */

import { createAuthClient } from 'better-auth/client';
import { electronClient } from '@better-auth/electron/client';

// AIDEV-NOTE: URL do Cloudflare Worker — substituir pela URL real apos deploy
// AIDEV-WARNING: Nao hardcode em producao — usar variavel de ambiente no build
const WORKER_URL =
  process.env.AUTH_WORKER_URL ?? 'https://openwork-auth.script7sistemas.workers.dev';

// AIDEV-NOTE: Simple in-memory storage for session/cookie data in main process
// In production, consider using electron-store or conf for persistence
const memoryStore: Record<string, unknown> = {};
const authStorage = {
  getItem: (name: string): unknown | null => memoryStore[name] ?? null,
  setItem: (name: string, value: unknown): void => {
    memoryStore[name] = value;
  },
};

export const authClient = createAuthClient({
  baseURL: `${WORKER_URL}/api/auth`,
  // AIDEV-NOTE: Electron main process envia Origin: null em fetch — forçar Origin valido
  fetchOptions: {
    headers: {
      Origin: 'app://openwork',
    },
  },
  plugins: [
    electronClient({
      clientID: 'electron',
      // AIDEV-NOTE: URL da pagina de login no Worker ou frontend
      signInURL: `${WORKER_URL}/api/auth/sign-in`,
      // AIDEV-NOTE: Protocolo custom do Electron para deep linking
      protocol: 'openwork',
      storage: authStorage,
    }),
  ],
});

export { WORKER_URL };
