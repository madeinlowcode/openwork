/**
 * @component AuthGate
 * @description Componente de protecao de rotas que verifica sessao via Better Auth.
 * Redireciona para /login se nao autenticado.
 * Suporta modo offline com grace period de 7 dias - usa sessao cacheada localmente
 * e valida com servidor em background.
 *
 * @dependencies
 * - react-router-dom (Navigate)
 * - lib/jurisiar.ts (getJurisiar)
 * - lucide-react (Loader2, WifiOff)
 *
 * @relatedFiles
 * - App.tsx (envolve rotas protegidas)
 * - pages/Login.tsx (destino do redirect)
 * - src/main/ipc/handlers.ts (handler auth:get-session, auth:get-local-session)
 *
 * @stateManagement
 * - useState: state ('checking' | 'authed' | 'unauthed'), offline (boolean)
 *
 * AIDEV-WARNING: Nao confundir com auth/AuthGuard.tsx (Supabase) — este usa Better Auth
 * AIDEV-NOTE: Fluxo: local primeiro (rapido) -> servidor em background (nao-bloqueante)
 * AIDEV-NOTE: Grace period de 7 dias para sessoes offline
 */

import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, WifiOff } from 'lucide-react';
import { getJurisiar, isRunningInElectron } from '@/lib/jurisiar';

/** Numero maximo de dias que uma sessao local pode ser usada sem validacao online */
const OFFLINE_GRACE_DAYS = 7;

/** Intervalo de refresh periodico da sessao (15 minutos) */
const SESSION_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Verifica se a sessao local expirou alem do grace period offline.
 * @param expiresAt - timestamp em ms (ou segundos) da expiracao do token
 * @param graceDays - dias de tolerancia offline
 * @returns true se a sessao esta expirada alem do grace period
 *
 * AIDEV-NOTE: expiresAt pode estar em segundos (Better Auth) ou ms — tratamos ambos
 */
function isExpiredBeyondGrace(expiresAt: number | undefined, graceDays: number): boolean {
  if (!expiresAt) return false; // Sem expiracao definida — aceitar
  // Normalizar para ms se valor parece estar em segundos (< 2000000000000)
  const expiresAtMs = expiresAt < 2_000_000_000_000 ? expiresAt * 1000 : expiresAt;
  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  return Date.now() > expiresAtMs + graceMs;
}

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<'checking' | 'authed' | 'unauthed'>('checking');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isRunningInElectron()) {
      setState('unauthed');
      return;
    }

    const jurisiar = getJurisiar();

    // AIDEV-NOTE: Fluxo invertido — checa LOCAL primeiro (rapido, sem rede),
    // depois valida com servidor em background (nao-bloqueante)
    const checkSession = async () => {
      // Fase 1: Verificar sessao local (rapido)
      let hasLocalSession = false;
      try {
        const localSession = await jurisiar.auth?.getLocalSession() as {
          accessToken?: string;
          refreshToken?: string;
          expiresAt?: number;
        } | null;

        if (localSession?.accessToken) {
          // Verificar se nao expirou alem do grace period
          if (!isExpiredBeyondGrace(localSession.expiresAt, OFFLINE_GRACE_DAYS)) {
            hasLocalSession = true;
            setState('authed');
            setOffline(true); // Inicialmente offline ate validar com servidor
          }
        }
      } catch {
        // Sem sessao local — continua para servidor
      }

      // Fase 2: Validar com servidor em background (nao-bloqueante)
      try {
        const session = await jurisiar.auth?.getSession();
        if (session) {
          setState('authed');
          setOffline(false); // Servidor confirmou — online
          return;
        }
        // Servidor respondeu mas sem sessao valida
        if (!hasLocalSession) {
          setState('unauthed');
        }
      } catch {
        // Servidor indisponivel
        if (!hasLocalSession) {
          setState('unauthed');
        }
        // Se tem local, ja esta 'authed' + offline=true
      }
    };

    checkSession();
  }, []);

  // AIDEV-NOTE: Refresh periodico a cada 15 minutos para detectar sessao expirada
  useEffect(() => {
    if (!isRunningInElectron() || state !== 'authed') return;

    const jurisiar = getJurisiar();

    const refreshSession = async () => {
      try {
        const session = await jurisiar.auth?.getSession();
        if (session) {
          setOffline(false);
          return;
        }
        // Servidor respondeu sem sessao — verificar local
        const localSession = await jurisiar.auth?.getLocalSession() as {
          accessToken?: string;
          expiresAt?: number;
        } | null;
        if (!localSession?.accessToken || isExpiredBeyondGrace(localSession.expiresAt, OFFLINE_GRACE_DAYS)) {
          setState('unauthed');
        }
      } catch {
        // Servidor indisponivel — manter estado atual (offline)
        setOffline(true);
      }
    };

    const intervalId = setInterval(refreshSession, SESSION_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [state]);

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'unauthed') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {offline && (
        <div className="flex items-center justify-center gap-2 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Modo Offline</span>
        </div>
      )}
      {children}
    </>
  );
}

export default AuthGate;
