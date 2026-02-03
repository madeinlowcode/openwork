/**
 * @component LoginForm
 * @description Formulario de login com email/senha usando Supabase Auth
 *
 * @context Auth > Login
 *
 * @dependencies
 * - lib/supabase.ts (signInWithEmail)
 * - lib/jurisiar.ts (auth.storeToken para persistencia)
 * - components/ui/button.tsx (Button)
 * - components/ui/input.tsx (Input)
 * - components/ui/label.tsx (Label)
 * - react-i18next (useTranslation)
 *
 * @relatedFiles
 * - components/auth/RegisterForm.tsx (formulario de registro)
 * - pages/Auth.tsx (pagina pai)
 * - lib/supabase.ts (funcoes de autenticacao)
 *
 * @stateManagement
 * - useState: email, password, isLoading, error
 *
 * AIDEV-WARNING: Validar inputs antes de enviar para API
 * AIDEV-WARNING: Nunca logar senhas ou tokens
 * AIDEV-SECURITY: Sanitizar mensagens de erro antes de exibir
 * AIDEV-NOTE: O token JWT e armazenado via IPC no main process
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithEmail } from '@/lib/supabase';
import { getJurisiar } from '@/lib/jurisiar';

// ============================================================================
// Types
// ============================================================================

interface LoginFormProps {
  /** Callback chamado apos login bem-sucedido */
  onSuccess?: () => void;
  /** Callback para alternar para registro */
  onSwitchToRegister?: () => void;
  /** Callback para recuperacao de senha */
  onForgotPassword?: () => void;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Valida formato de email
 * AIDEV-NOTE: Validacao basica - Supabase faz validacao completa
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// Component
// ============================================================================

export function LoginForm({ onSuccess, onSwitchToRegister, onForgotPassword }: LoginFormProps) {
  const { t } = useTranslation('auth');

  // Form state
  // AIDEV-NOTE: Estado local para formulario - nao precisa de store global
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle form submission
  // AIDEV-WARNING: Validar inputs antes de chamar API
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validacoes
      if (!email.trim()) {
        setError(t('login.errors.emailRequired'));
        return;
      }

      if (!isValidEmail(email)) {
        setError(t('login.errors.invalidEmail'));
        return;
      }

      if (!password) {
        setError(t('login.errors.passwordRequired'));
        return;
      }

      setIsLoading(true);

      try {
        // AIDEV-NOTE: Chamar Supabase Auth
        const result = await signInWithEmail(email, password);

        if (!result.success) {
          // AIDEV-SECURITY: Nao expor detalhes de erro de autenticacao
          if (result.error?.includes('Invalid login credentials')) {
            setError(t('login.errors.invalidCredentials'));
          } else {
            setError(t('login.errors.generic'));
          }
          return;
        }

        // AIDEV-NOTE: Armazenar token no main process via IPC
        if (result.session) {
          try {
            const jurisiar = getJurisiar();
            // AIDEV-WARNING: auth.storeToken deve existir no IPC
            if (jurisiar.auth?.storeToken) {
              await jurisiar.auth.storeToken({
                accessToken: result.session.access_token,
                refreshToken: result.session.refresh_token,
                expiresAt: result.session.expires_at,
              });
            }
          } catch (storageError) {
            console.error('[LoginForm] Failed to store token:', storageError);
            // Continuar mesmo se falhar storage - usuario esta logado
          }
        }

        // Sucesso
        onSuccess?.();
      } catch (err) {
        console.error('[LoginForm] Login error:', err);
        setError(t('login.errors.generic'));
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, t, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('login.email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="pl-10"
            autoComplete="email"
            autoFocus
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('login.password')}</Label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-primary hover:underline"
              disabled={isLoading}
            >
              {t('login.forgotPassword')}
            </button>
          )}
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="pl-10"
            autoComplete="current-password"
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('login.submitting')}
          </>
        ) : (
          t('login.submit')
        )}
      </Button>

      {/* Switch to Register */}
      {onSwitchToRegister && (
        <p className="text-center text-sm text-muted-foreground">
          {t('login.noAccount')}{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-primary hover:underline"
            disabled={isLoading}
          >
            {t('login.signUp')}
          </button>
        </p>
      )}
    </form>
  );
}

export default LoginForm;
