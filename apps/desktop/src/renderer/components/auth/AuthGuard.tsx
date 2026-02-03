/**
 * @component AuthGuard
 * @description Wrapper que protege rotas que requerem autenticacao
 *
 * @context Layout wrapper - envolve componentes que precisam de autenticacao
 *
 * @dependencies
 * - react-router-dom (useNavigate, useLocation)
 * - lib/jurisiar.ts (auth.getToken, auth.isAuthenticated)
 * - lib/supabase.ts (restoreSession, getCurrentUser)
 * - react-i18next (useTranslation)
 *
 * @relatedFiles
 * - App.tsx (usa AuthGuard para proteger rotas)
 * - pages/Auth.tsx (pagina de redirecionamento)
 * - lib/supabase.ts (verificacao de autenticacao)
 *
 * @stateManagement
 * - useState: isChecking (verificando autenticacao)
 * - useState: isAuthenticated (resultado da verificacao)
 *
 * AIDEV-WARNING: Redireciona para /auth se nao autenticado
 * AIDEV-WARNING: Verificar token no main process antes de permitir acesso
 * AIDEV-NOTE: Usa useEffect para verificar auth no mount
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { getJurisiar, isRunningInElectron } from '@/lib/jurisiar';
import { isSupabaseInitialized, restoreSession, getCurrentUser } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

interface AuthGuardProps {
  /** Conteudo a ser renderizado se autenticado */
  children: ReactNode;
  /** Rota de redirecionamento se nao autenticado (default: /auth) */
  redirectTo?: string;
  /** Se true, inverte a logica (mostra se NAO autenticado) */
  requireUnauthenticated?: boolean;
  /** Callback chamado quando auth state muda */
  onAuthStateChange?: (isAuthenticated: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AuthGuard({
  children,
  redirectTo = '/auth',
  requireUnauthenticated = false,
  onAuthStateChange,
}: AuthGuardProps) {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();

  // State
  // AIDEV-NOTE: isChecking = true durante verificacao inicial
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  // AIDEV-WARNING: Esta funcao verifica token no main process e restaura sessao Supabase
  const checkAuth = useCallback(async () => {
    try {
      // AIDEV-NOTE: Se nao esta no Electron, nao pode verificar auth
      if (!isRunningInElectron()) {
        console.warn('[AuthGuard] Not running in Electron');
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      const jurisiar = getJurisiar();

      // AIDEV-NOTE: Verificar se temos token armazenado no main process
      if (!jurisiar.auth?.getToken) {
        console.warn('[AuthGuard] Auth API not available');
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      const storedToken = await jurisiar.auth.getToken();

      if (!storedToken) {
        // Sem token armazenado
        setIsAuthenticated(false);
        setIsChecking(false);
        onAuthStateChange?.(false);
        return;
      }

      // AIDEV-NOTE: Verificar se Supabase esta inicializado
      if (!isSupabaseInitialized()) {
        // Supabase nao inicializado - tentar obter config e inicializar
        if (jurisiar.auth?.getSupabaseConfig) {
          try {
            const config = await jurisiar.auth.getSupabaseConfig();
            if (config) {
              const { initSupabase } = await import('@/lib/supabase');
              initSupabase(config);
            }
          } catch (err) {
            console.error('[AuthGuard] Failed to init Supabase:', err);
            setIsAuthenticated(false);
            setIsChecking(false);
            return;
          }
        }
      }

      // AIDEV-NOTE: Tentar restaurar sessao com token armazenado
      const result = await restoreSession(storedToken.accessToken, storedToken.refreshToken);

      if (result.success && result.user) {
        setIsAuthenticated(true);
        onAuthStateChange?.(true);
      } else {
        // Token invalido ou expirado - limpar
        if (jurisiar.auth?.clearToken) {
          await jurisiar.auth.clearToken();
        }
        setIsAuthenticated(false);
        onAuthStateChange?.(false);
      }
    } catch (err) {
      console.error('[AuthGuard] Auth check error:', err);
      setIsAuthenticated(false);
      onAuthStateChange?.(false);
    } finally {
      setIsChecking(false);
    }
  }, [onAuthStateChange]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle redirect
  useEffect(() => {
    if (isChecking) return;

    const shouldRedirect = requireUnauthenticated ? isAuthenticated : !isAuthenticated;

    if (shouldRedirect) {
      // AIDEV-NOTE: Salvar location atual para redirect apos login
      const redirectPath = requireUnauthenticated ? '/' : redirectTo;
      const state = requireUnauthenticated ? undefined : { from: location.pathname };

      navigate(redirectPath, { replace: true, state });
    }
  }, [isChecking, isAuthenticated, requireUnauthenticated, navigate, location.pathname, redirectTo]);

  // Loading state
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('status.checking')}</p>
        </div>
      </div>
    );
  }

  // Check if should show content
  const shouldShowContent = requireUnauthenticated ? !isAuthenticated : isAuthenticated;

  if (!shouldShowContent) {
    // Redirecionando - mostrar loading
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('guard.redirecting')}</p>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}

// ============================================================================
// Hook for auth state
// ============================================================================

/**
 * Hook para verificar estado de autenticacao
 *
 * @returns { isAuthenticated, isLoading, user, refresh }
 *
 * AIDEV-NOTE: Use este hook em componentes que precisam saber se usuario esta logado
 *
 * @example
 * const { isAuthenticated, user } = useAuthState();
 * if (isAuthenticated) {
 *   console.log('User:', user?.email);
 * }
 */
export function useAuthState() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<Awaited<ReturnType<typeof getCurrentUser>>>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isRunningInElectron()) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      const currentUser = await getCurrentUser();
      setIsAuthenticated(!!currentUser);
      setUser(currentUser);
    } catch (err) {
      console.error('[useAuthState] Error:', err);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isAuthenticated, isLoading, user, refresh };
}

export default AuthGuard;
