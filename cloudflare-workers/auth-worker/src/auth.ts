/**
 * @function createAuth
 * @description Configura instância do Better Auth com PostgreSQL via Hyperdrive,
 *              plugin Electron e campos customizados de plano/licença.
 *
 * @param {Object} env - Variáveis de ambiente do Cloudflare Worker
 * @param {string} env.DATABASE_URL - Connection string fornecida pelo Hyperdrive
 * @param {string} env.BETTER_AUTH_SECRET - Secret para assinatura de tokens
 * @returns {ReturnType<typeof betterAuth>} Instância configurada do Better Auth
 *
 * @dependencies
 * - better-auth (betterAuth)
 * - better-auth/plugins (electron)
 * - pg (Pool)
 *
 * @relatedFiles
 * - src/index.ts (consome createAuth)
 *
 * ⚠️ AIDEV-WARNING: Alterações nos additionalFields requerem migration no PostgreSQL
 * 🔒 AIDEV-SECURITY: BETTER_AUTH_SECRET deve ter mínimo 32 chars
 */
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { electron } from 'better-auth/plugins';

export function createAuth(env: { DATABASE_URL: string; BETTER_AUTH_SECRET: string }) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    database: new Pool({
      connectionString: env.DATABASE_URL,
      // AIDEV-NOTE: Cloudflare Hyperdrive fornece DATABASE_URL com pooling automático
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // habilitar quando tiver email configurado
    },
    plugins: [
      electron(), // Habilita fluxo de auth para Electron
    ],
    trustedOrigins: [
      'app://openwork',  // protocolo custom do Electron
      'http://localhost', // dev
    ],
    user: {
      additionalFields: {
        plan: {
          type: 'string',
          defaultValue: 'free',
          input: false, // não pode ser modificado pelo usuário diretamente
        },
        licenseExpiresAt: {
          type: 'date',
          input: false,
        },
      },
    },
  });
}
