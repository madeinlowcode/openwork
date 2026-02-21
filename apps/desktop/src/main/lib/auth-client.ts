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
import { storeAuthToken, getAuthToken, clearAuthToken } from '../store/secureStorage';

// AIDEV-NOTE: URL do Cloudflare Worker — substituir pela URL real apos deploy
// AIDEV-WARNING: Nao hardcode em producao — usar variavel de ambiente no build
const WORKER_URL =
  process.env.AUTH_WORKER_URL ?? 'https://openwork-auth.script7sistemas.workers.dev';

// AIDEV-NOTE: Persistência de sessão usando secureStorage (electron-store com AES-256-GCM)
// AIDEV-WARNING: Sessão persiste entre reinícios do app - mais seguro que memória
const SESSION_KEY = 'betterauth_session';

const authStorage = {
  getItem: (name: string): unknown | null => {
    if (name !== SESSION_KEY) return null;
    const stored = getAuthToken();
    if (!stored) return null;
    // Retorna no formato esperado pelo better-auth
    return { accessToken: stored.accessToken, refreshToken: stored.refreshToken };
  },
  setItem: (name: string, value: unknown): void => {
    if (name !== SESSION_KEY) return;
    const sessionData = value as { accessToken: string; refreshToken: string } | null;
    if (!sessionData) {
      clearAuthToken();
      return;
    }
    storeAuthToken({
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
    });
  },
  removeItem: (name: string): void => {
    if (name === SESSION_KEY) {
      clearAuthToken();
    }
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

// AIDEV-NOTE: Periodic session refresh (15 minutos) para manter token válido
// AIDEV-WARNING: Refresh automático evita expiração de sessão durante uso prolongado
const SESSION_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
let sessionRefreshTimer: NodeJS.Timeout | null = null;

/**
 * Inicia o timer de refresh de sessão
 * Chamar quando o usuário fazer login com sucesso
 */
export function startSessionRefresh(): void {
  if (sessionRefreshTimer) return; // Já está rodando

  sessionRefreshTimer = setInterval(async () => {
    try {
      // AIDEV-NOTE: getSession força refresh do token se necessário
      await authClient.getSession();
      console.log('[Auth] Session checked/refreshed successfully');
    } catch (err) {
      // Se falhar, pode ser que a sessão expirou - não faz nada
      console.log('[Auth] Session refresh failed:', err);
    }
  }, SESSION_REFRESH_INTERVAL_MS);
}

/**
 * Para o timer de refresh de sessão
 * Chamar quando o usuário fazer logout
 */
export function stopSessionRefresh(): void {
  if (sessionRefreshTimer) {
    clearInterval(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
}

export { WORKER_URL };
