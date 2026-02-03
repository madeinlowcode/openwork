/**
 * @module auth
 * @description Exporta todos os componentes de autenticacao
 *
 * @exports
 * - LoginForm: Formulario de login
 * - RegisterForm: Formulario de registro
 * - AuthGuard: Wrapper de protecao de rotas
 * - useAuthState: Hook para estado de autenticacao
 *
 * AIDEV-NOTE: Importar componentes deste index para melhor organizacao
 *
 * @example
 * import { LoginForm, AuthGuard, useAuthState } from '@/components/auth';
 */

export { LoginForm } from './LoginForm';
export { RegisterForm } from './RegisterForm';
export { AuthGuard, useAuthState } from './AuthGuard';
