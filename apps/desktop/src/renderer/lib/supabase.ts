/**
 * @module supabase
 * @description Cliente Supabase para autenticacao e comunicacao com Edge Functions
 *
 * @context Renderer process - cliente de autenticacao Supabase
 *
 * @dependencies
 * - @supabase/supabase-js (cliente oficial Supabase)
 *
 * @usedBy
 * - components/auth/LoginForm.tsx
 * - components/auth/RegisterForm.tsx
 * - components/auth/AuthGuard.tsx
 * - lib/jurisiar.ts (chamadas as Edge Functions)
 *
 * @relatedFiles
 * - main/ipc/handlers.ts (fornece config via IPC)
 * - main/store/secureStorage.ts (armazena token)
 * - preload/index.ts (expoe API de auth)
 *
 * AIDEV-WARNING: URLs e keys vem do main process via IPC
 * AIDEV-WARNING: Este cliente e singleton - inicializar apenas uma vez
 * AIDEV-SECURITY: Nunca expor service_role_key no renderer
 * AIDEV-NOTE: O token JWT e armazenado de forma segura via electron-store no main process
 */

import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuracao do Supabase recebida do main process
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Estado de autenticacao do usuario
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Resultado de operacoes de autenticacao
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

// ============================================================================
// Singleton State
// ============================================================================

// AIDEV-NOTE: Cliente Supabase singleton - inicializado uma vez via initSupabase()
let _supabaseClient: SupabaseClient | null = null;
let _config: SupabaseConfig | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Inicializa o cliente Supabase com a configuracao recebida do main process
 *
 * @param config - Configuracao com URL e anon key do Supabase
 * @throws Error se ja inicializado com config diferente
 *
 * AIDEV-WARNING: Chamar apenas uma vez na inicializacao do app
 * AIDEV-NOTE: A config vem do main process via IPC (auth:get-supabase-config)
 *
 * @example
 * const config = await window.jurisiar.auth.getSupabaseConfig();
 * initSupabase(config);
 */
export function initSupabase(config: SupabaseConfig): void {
  if (_supabaseClient && _config) {
    // Ja inicializado - verificar se config mudou
    if (_config.url !== config.url || _config.anonKey !== config.anonKey) {
      console.warn('[Supabase] Config changed - reinitializing client');
      _supabaseClient = null;
    } else {
      // Config igual - nao precisa reinicializar
      return;
    }
  }

  if (!config.url || !config.anonKey) {
    throw new Error('Supabase config is incomplete. URL and anonKey are required.');
  }

  _config = config;
  _supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      // AIDEV-NOTE: Desabilitar persistencia automatica - gerenciamos via electron-store
      persistSession: false,
      // AIDEV-NOTE: Desabilitar auto refresh - gerenciamos manualmente
      autoRefreshToken: false,
      // AIDEV-NOTE: Desabilitar deteccao de sessao em outras abas (nao aplicavel em Electron)
      detectSessionInUrl: false,
    },
  });

  console.log('[Supabase] Client initialized successfully');
}

/**
 * Obtem o cliente Supabase inicializado
 *
 * @returns Cliente Supabase
 * @throws Error se nao inicializado
 *
 * AIDEV-WARNING: Chamar initSupabase() antes de usar esta funcao
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    throw new Error('Supabase not initialized. Call initSupabase() first.');
  }
  return _supabaseClient;
}

/**
 * Verifica se o cliente Supabase foi inicializado
 *
 * @returns true se inicializado
 */
export function isSupabaseInitialized(): boolean {
  return _supabaseClient !== null;
}

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Realiza login com email e senha
 *
 * @param email - Email do usuario
 * @param password - Senha do usuario
 * @returns Resultado da autenticacao
 *
 * AIDEV-NOTE: O token JWT retornado deve ser armazenado via IPC no main process
 *
 * @example
 * const result = await signInWithEmail('user@example.com', 'password123');
 * if (result.success) {
 *   await window.jurisiar.auth.storeToken(result.session.access_token);
 * }
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (err) {
    console.error('[Supabase] Sign in error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during sign in',
    };
  }
}

/**
 * Registra novo usuario com email e senha
 *
 * @param email - Email do usuario
 * @param password - Senha do usuario
 * @param metadata - Metadados adicionais (ex: nome)
 * @returns Resultado da autenticacao
 *
 * AIDEV-NOTE: Pode requerer confirmacao de email dependendo das config do Supabase
 *
 * @example
 * const result = await signUpWithEmail('user@example.com', 'password123', { name: 'John' });
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: { name?: string; [key: string]: unknown }
): Promise<AuthResult> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (err) {
    console.error('[Supabase] Sign up error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during sign up',
    };
  }
}

/**
 * Realiza logout do usuario
 *
 * @returns Resultado da operacao
 *
 * AIDEV-NOTE: Tambem deve limpar o token armazenado no main process
 *
 * @example
 * const result = await signOut();
 * if (result.success) {
 *   await window.jurisiar.auth.clearToken();
 * }
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[Supabase] Sign out error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during sign out',
    };
  }
}

/**
 * Envia email de recuperacao de senha
 *
 * @param email - Email do usuario
 * @returns Resultado da operacao
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(email);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[Supabase] Password reset error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending reset email',
    };
  }
}

/**
 * Restaura sessao a partir de um token JWT armazenado
 *
 * @param accessToken - Token de acesso JWT
 * @param refreshToken - Token de refresh (opcional)
 * @returns Resultado da restauracao
 *
 * AIDEV-NOTE: Usado para restaurar sessao ao iniciar o app
 *
 * @example
 * const token = await window.jurisiar.auth.getToken();
 * if (token) {
 *   const result = await restoreSession(token.accessToken, token.refreshToken);
 * }
 */
export async function restoreSession(
  accessToken: string,
  refreshToken?: string
): Promise<AuthResult> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (err) {
    console.error('[Supabase] Restore session error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error restoring session',
    };
  }
}

/**
 * Obtem o usuario atualmente autenticado
 *
 * @returns Usuario atual ou null
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch (err) {
    console.error('[Supabase] Get current user error:', err);
    return null;
  }
}

/**
 * Obtem a sessao atual
 *
 * @returns Sessao atual ou null
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const client = getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    return session;
  } catch (err) {
    console.error('[Supabase] Get current session error:', err);
    return null;
  }
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Atualiza o token de acesso usando o refresh token
 *
 * @returns Nova sessao ou null se falhou
 *
 * AIDEV-NOTE: Chamar quando o token expirar (401 errors)
 */
export async function refreshAccessToken(): Promise<Session | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.refreshSession();

    if (error || !data.session) {
      console.error('[Supabase] Token refresh failed:', error?.message);
      return null;
    }

    return data.session;
  } catch (err) {
    console.error('[Supabase] Token refresh error:', err);
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { User, Session } from '@supabase/supabase-js';
