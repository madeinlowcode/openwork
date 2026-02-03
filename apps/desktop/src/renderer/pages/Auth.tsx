/**
 * @page Auth
 * @description Pagina de autenticacao (login/registro) do Jurisiar
 *
 * @route /auth
 *
 * @dependencies
 * - components/auth/LoginForm.tsx (formulario de login)
 * - components/auth/RegisterForm.tsx (formulario de registro)
 * - components/ui/card.tsx (Card container)
 * - react-router-dom (useNavigate, useLocation)
 * - react-i18next (useTranslation)
 * - lib/supabase.ts (initSupabase)
 * - lib/jurisiar.ts (auth.getSupabaseConfig)
 *
 * @relatedFiles
 * - App.tsx (define rota /auth)
 * - components/auth/AuthGuard.tsx (redireciona para ca se nao autenticado)
 * - lib/supabase.ts (cliente Supabase)
 *
 * @stateManagement
 * - useState: mode ('login' | 'register' | 'forgot-password')
 * - useState: isInitializing (inicializando Supabase)
 *
 * AIDEV-WARNING: Inicializar Supabase antes de mostrar formularios
 * AIDEV-NOTE: Redireciona para / apos login bem-sucedido
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Scale } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { getJurisiar, isRunningInElectron } from '@/lib/jurisiar';
import { initSupabase, isSupabaseInitialized } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

type AuthMode = 'login' | 'register' | 'forgot-password';

interface LocationState {
  from?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function AuthPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();

  // State
  // AIDEV-NOTE: mode controla qual formulario exibir
  const [mode, setMode] = useState<AuthMode>('login');
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Get redirect path from location state
  // AIDEV-NOTE: AuthGuard passa 'from' quando redireciona para /auth
  const locationState = location.state as LocationState | null;
  const redirectPath = locationState?.from || '/';

  // Initialize Supabase
  // AIDEV-WARNING: Supabase deve ser inicializado antes de usar auth
  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        // AIDEV-NOTE: Se ja inicializado, nao precisa fazer nada
        if (isSupabaseInitialized()) {
          setIsInitializing(false);
          return;
        }

        // AIDEV-NOTE: Verificar se esta no Electron
        if (!isRunningInElectron()) {
          setInitError('Este aplicativo deve ser executado dentro do Juris IA desktop.');
          setIsInitializing(false);
          return;
        }

        const jurisiar = getJurisiar();

        // AIDEV-NOTE: Obter config do Supabase via IPC
        if (!jurisiar.auth?.getSupabaseConfig) {
          setInitError('Auth API not available');
          setIsInitializing(false);
          return;
        }

        const config = await jurisiar.auth.getSupabaseConfig();

        if (!config || !config.url || !config.anonKey) {
          setInitError('Supabase configuration not available');
          setIsInitializing(false);
          return;
        }

        // AIDEV-NOTE: Inicializar cliente Supabase
        initSupabase(config);
        setIsInitializing(false);
      } catch (err) {
        console.error('[AuthPage] Failed to initialize Supabase:', err);
        setInitError('Failed to initialize authentication');
        setIsInitializing(false);
      }
    };

    initializeSupabase();
  }, []);

  // Handle successful login
  // AIDEV-NOTE: Redireciona para pagina original ou home
  const handleLoginSuccess = useCallback(() => {
    navigate(redirectPath, { replace: true });
  }, [navigate, redirectPath]);

  // Handle successful register
  // AIDEV-NOTE: Se nao precisa confirmar email, redireciona; senao mostra mensagem
  const handleRegisterSuccess = useCallback(
    (requiresEmailConfirmation: boolean) => {
      if (!requiresEmailConfirmation) {
        // Login automatico - redirecionar
        navigate(redirectPath, { replace: true });
      }
      // Se precisa confirmar email, o formulario mostra mensagem de sucesso
    },
    [navigate, redirectPath]
  );

  // Loading state
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Inicializando...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Scale className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground">Erro de Inicializacao</h1>
          <p className="text-muted-foreground">{initError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Main Card Container */}
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {/* Logo/Brand */}
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Scale className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Juris IA</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>

          {/* Form based on mode */}
          {mode === 'login' && (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => setMode('register')}
              onForgotPassword={() => setMode('forgot-password')}
            />
          )}

          {mode === 'register' && (
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onSwitchToLogin={() => setMode('login')}
            />
          )}

          {mode === 'forgot-password' && (
            <ForgotPasswordForm onBackToLogin={() => setMode('login')} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Forgot Password Form (inline component)
// ============================================================================

/**
 * @component ForgotPasswordForm
 * @description Formulario de recuperacao de senha
 *
 * AIDEV-NOTE: Componente inline por simplicidade - pode ser extraido se necessario
 */
function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(t('forgotPassword.errors.emailRequired'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('forgotPassword.errors.invalidEmail'));
      return;
    }

    setIsLoading(true);

    try {
      const { sendPasswordResetEmail } = await import('@/lib/supabase');
      const result = await sendPasswordResetEmail(email);

      if (!result.success) {
        setError(t('forgotPassword.errors.generic'));
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('[ForgotPasswordForm] Error:', err);
      setError(t('forgotPassword.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  // Importing inline to keep this file self-contained
  const { Input } = require('@/components/ui/input');
  const { Button } = require('@/components/ui/button');
  const { Label } = require('@/components/ui/label');
  const { Mail, AlertCircle, CheckCircle, Loader2, ArrowLeft } = require('lucide-react');

  if (success) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t('forgotPassword.title')}</h2>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{t('forgotPassword.success')}</span>
        </div>

        <Button variant="outline" className="w-full" onClick={onBackToLogin}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('forgotPassword.backToLogin')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('forgotPassword.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('forgotPassword.subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="forgot-email">{t('forgotPassword.email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="forgot-email"
            type="email"
            placeholder={t('forgotPassword.emailPlaceholder')}
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            disabled={isLoading}
            className="pl-10"
            autoComplete="email"
            autoFocus
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('forgotPassword.submitting')}
          </>
        ) : (
          t('forgotPassword.submit')
        )}
      </Button>

      <Button variant="outline" className="w-full" onClick={onBackToLogin} disabled={isLoading}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('forgotPassword.backToLogin')}
      </Button>
    </form>
  );
}
