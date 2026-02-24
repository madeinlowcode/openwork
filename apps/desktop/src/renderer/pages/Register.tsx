/**
 * @page RegisterPage
 * @description Pagina de registro de novo usuario via Better Auth (Cloudflare Worker).
 * Formulario com nome, email, senha e confirmacao de senha.
 *
 * @route /register
 *
 * @dependencies
 * - react-router-dom (useNavigate)
 * - components/ui/button.tsx (Button)
 * - lib/jurisiar.ts (getJurisiar)
 * - lucide-react (Loader2, Scale)
 *
 * @relatedFiles
 * - App.tsx (define rota /register)
 * - pages/Login.tsx (pagina de login - mesmo estilo visual)
 * - components/AuthGate.tsx (redireciona se nao autenticado)
 * - src/main/lib/auth-client.ts (cliente Better Auth no main process)
 * - src/main/ipc/handlers.ts (handler auth:sign-up)
 * - src/preload/index.ts (expoe auth.signUp via IPC)
 *
 * @stateManagement
 * - useState: name, email, password, confirmPassword, error, loading
 *
 * AIDEV-WARNING: Nao confundir com Auth.tsx (Supabase) — este usa Better Auth
 * AIDEV-NOTE: Redireciona para /login com state { registered: true } apos sucesso
 */

'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getJurisiar } from '@/lib/jurisiar';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // AIDEV-NOTE: Validacao client-side antes de enviar ao servidor
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('E-mail inválido');
      return;
    }

    if (password.length < 8) {
      setError('Senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const jurisiar = getJurisiar();
      await jurisiar.auth?.signUp({ name, email, password });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
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
          <h1 className="text-lg font-semibold text-foreground">Criar conta no Openwork</h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados para se cadastrar
          </p>
        </div>

        {/* Error message */}
        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Name */}
        <div className="space-y-1">
          <label htmlFor="register-name" className="text-sm font-medium text-foreground">
            Nome completo
          </label>
          <input
            id="register-name"
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoFocus
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="register-email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <input
            id="register-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label htmlFor="register-password" className="text-sm font-medium text-foreground">
            Senha
          </label>
          <input
            id="register-password"
            type="password"
            placeholder="Minimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            minLength={8}
          />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label htmlFor="register-confirm-password" className="text-sm font-medium text-foreground">
            Confirmar senha
          </label>
          <input
            id="register-confirm-password"
            type="password"
            placeholder="Repita a senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando conta...
            </>
          ) : (
            'Criar conta'
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Ja tem conta?{' '}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => navigate('/login')}
          >
            Entrar
          </button>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
