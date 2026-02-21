/**
 * @component AuthGate
 * @description Componente de protecao de rotas que verifica sessao local.
 * Redireciona para /login se nao autenticado.
 *
 * @dependencies
 * - react-router-dom (Navigate)
 * - lib/jurisiar.ts (getJurisiar, isRunningInElectron)
 * - lucide-react (Loader2)
 *
 * @relatedFiles
 * - App.tsx (envolve rotas protegidas)
 * - pages/Login.tsx (destino do redirect)
 * - src/main/ipc/handlers.ts (handler auth:get-local-session)
 *
 * AIDEV-WARNING: Nao confundir com auth/AuthGuard.tsx (Supabase) — este usa Better Auth
 * AIDEV-NOTE: Verifica token local apenas — validacao server-side e feita no /api/task/authorize
 */

import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getJurisiar, isRunningInElectron } from '@/lib/jurisiar';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<'checking' | 'authed' | 'unauthed'>('checking');

  useEffect(() => {
    if (!isRunningInElectron()) {
      setState('unauthed');
      return;
    }

    const checkAuth = async () => {
      try {
        const jurisiar = getJurisiar();
        const localSession = await jurisiar.auth?.getLocalSession() as {
          accessToken?: string;
        } | null;

        setState(localSession?.accessToken ? 'authed' : 'unauthed');
      } catch {
        setState('unauthed');
      }
    };

    checkAuth();
  }, []);

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

  return <>{children}</>;
}

export default AuthGate;
