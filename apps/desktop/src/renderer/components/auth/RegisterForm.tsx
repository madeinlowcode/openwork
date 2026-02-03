/**
 * @component RegisterForm
 * @description Formulario de registro de novo usuario usando Supabase Auth
 *
 * @context Auth > Register
 *
 * @dependencies
 * - lib/supabase.ts (signUpWithEmail)
 * - lib/jurisiar.ts (auth.storeToken para persistencia)
 * - components/ui/button.tsx (Button)
 * - components/ui/input.tsx (Input)
 * - components/ui/label.tsx (Label)
 * - react-i18next (useTranslation)
 *
 * @relatedFiles
 * - components/auth/LoginForm.tsx (formulario de login)
 * - pages/Auth.tsx (pagina pai)
 * - lib/supabase.ts (funcoes de autenticacao)
 *
 * @stateManagement
 * - useState: name, email, password, confirmPassword, isLoading, error
 *
 * AIDEV-WARNING: Validar forca da senha antes de enviar
 * AIDEV-WARNING: Nunca logar senhas ou tokens
 * AIDEV-SECURITY: Implementar rate limiting no backend
 * AIDEV-NOTE: Pode requerer confirmacao de email dependendo das config do Supabase
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpWithEmail } from '@/lib/supabase';
import { getJurisiar } from '@/lib/jurisiar';

// ============================================================================
// Types
// ============================================================================

interface RegisterFormProps {
  /** Callback chamado apos registro bem-sucedido */
  onSuccess?: (requiresEmailConfirmation: boolean) => void;
  /** Callback para alternar para login */
  onSwitchToLogin?: () => void;
}

// ============================================================================
// Validation
// ============================================================================

const MIN_PASSWORD_LENGTH = 8;

/**
 * Valida formato de email
 * AIDEV-NOTE: Validacao basica - Supabase faz validacao completa
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida forca da senha
 * AIDEV-NOTE: Minimo 8 caracteres - ajustar conforme requisitos
 */
function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

// ============================================================================
// Component
// ============================================================================

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const { t } = useTranslation('auth');

  // Form state
  // AIDEV-NOTE: Estado local para formulario - nao precisa de store global
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle form submission
  // AIDEV-WARNING: Validar todos os inputs antes de chamar API
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMessage(null);

      // Validacoes
      if (!name.trim()) {
        setError(t('register.errors.nameRequired'));
        return;
      }

      if (!email.trim()) {
        setError(t('register.errors.emailRequired'));
        return;
      }

      if (!isValidEmail(email)) {
        setError(t('register.errors.invalidEmail'));
        return;
      }

      if (!password) {
        setError(t('register.errors.passwordRequired'));
        return;
      }

      if (!isValidPassword(password)) {
        setError(t('register.errors.passwordTooShort'));
        return;
      }

      if (!confirmPassword) {
        setError(t('register.errors.confirmPasswordRequired'));
        return;
      }

      if (password !== confirmPassword) {
        setError(t('register.errors.passwordsDoNotMatch'));
        return;
      }

      setIsLoading(true);

      try {
        // AIDEV-NOTE: Chamar Supabase Auth com metadata do nome
        const result = await signUpWithEmail(email, password, { name: name.trim() });

        if (!result.success) {
          // AIDEV-SECURITY: Mapear erros comuns para mensagens amigaveis
          if (result.error?.includes('already registered') || result.error?.includes('already exists')) {
            setError(t('register.errors.emailAlreadyExists'));
          } else {
            setError(t('register.errors.generic'));
          }
          return;
        }

        // AIDEV-NOTE: Verificar se requer confirmacao de email
        // Se session == null, significa que precisa confirmar email
        const requiresEmailConfirmation = !result.session;

        if (result.session) {
          // AIDEV-NOTE: Armazenar token no main process via IPC
          try {
            const jurisiar = getJurisiar();
            if (jurisiar.auth?.storeToken) {
              await jurisiar.auth.storeToken({
                accessToken: result.session.access_token,
                refreshToken: result.session.refresh_token,
                expiresAt: result.session.expires_at,
              });
            }
          } catch (storageError) {
            console.error('[RegisterForm] Failed to store token:', storageError);
            // Continuar mesmo se falhar storage
          }

          setSuccessMessage(t('register.successNoConfirmation'));
        } else {
          setSuccessMessage(t('register.success'));
        }

        // Callback de sucesso
        onSuccess?.(requiresEmailConfirmation);
      } catch (err) {
        console.error('[RegisterForm] Register error:', err);
        setError(t('register.errors.generic'));
      } finally {
        setIsLoading(false);
      }
    },
    [name, email, password, confirmPassword, t, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('register.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('register.subtitle')}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('register.name')}</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="name"
            type="text"
            placeholder={t('register.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading || !!successMessage}
            className="pl-10"
            autoComplete="name"
            autoFocus
          />
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('register.email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t('register.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || !!successMessage}
            className="pl-10"
            autoComplete="email"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password">{t('register.password')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder={t('register.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || !!successMessage}
            className="pl-10"
            autoComplete="new-password"
          />
        </div>
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('register.confirmPassword')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t('register.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading || !!successMessage}
            className="pl-10"
            autoComplete="new-password"
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading || !!successMessage}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('register.submitting')}
          </>
        ) : (
          t('register.submit')
        )}
      </Button>

      {/* Switch to Login */}
      {onSwitchToLogin && (
        <p className="text-center text-sm text-muted-foreground">
          {t('register.hasAccount')}{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-primary hover:underline"
            disabled={isLoading}
          >
            {t('register.signIn')}
          </button>
        </p>
      )}
    </form>
  );
}

export default RegisterForm;
