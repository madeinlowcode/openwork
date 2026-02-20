/**
 * @page LoginPage
 * @description Pagina de login via Better Auth (Cloudflare Worker).
 * Formulario de email/senha que autentica via IPC -> main process -> Worker.
 *
 * @route /login
 *
 * @dependencies
 * - react-router-dom (useNavigate)
 * - components/ui/button.tsx (Button)
 * - lib/jurisiar.ts (getJurisiar)
 *
 * @relatedFiles
 * - App.tsx (define rota /login)
 * - components/AuthGate.tsx (redireciona para /login se nao autenticado)
 * - src/main/lib/auth-client.ts (cliente Better Auth no main process)
 * - src/main/ipc/handlers.ts (handler auth:sign-in)
 *
 * @stateManagement
 * - useState: email, password, error, loading
 *
 * AIDEV-WARNING: Nao confundir com Auth.tsx (Supabase) — este usa Better Auth
 * AIDEV-NOTE: Redireciona para / apos login bem-sucedido
 */

'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getJurisiar } from '@/lib/jurisiar';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const jurisiar = getJurisiar();
      await jurisiar.auth?.signIn({ email, password });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciais invalidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Invisible drag region for window dragging (macOS hiddenInset titlebar) */}
      <div className="drag-region fixed top-0 left-0 right-0 h-10 z-50 pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-8"
      >
        {/* Logo/Header */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Entrar no Openwork</h1>
          <p className="text-sm text-muted-foreground">
            Insira suas credenciais para continuar
          </p>
        </div>

        {/* Error message */}
        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="login-email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoFocus
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label htmlFor="login-password" className="text-sm font-medium text-foreground">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Nao tem conta?{' '}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => {
              const jurisiar = getJurisiar();
              jurisiar.openExternal('https://openwork.app/register');
            }}
          >
            Criar conta
          </button>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
