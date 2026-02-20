/**
 * @function createAuth
 * @description Configura instância do Better Auth com PostgreSQL via Hyperdrive
 *              e campos customizados de plano/licença.
 *
 * @dependencies
 * - better-auth (betterAuth)
 * - pg (Pool)
 *
 * @relatedFiles
 * - src/index.ts (consome createAuth)
 *
 * ⚠️ AIDEV-WARNING: Alterações nos additionalFields requerem migration no PostgreSQL
 * 🔒 AIDEV-SECURITY: BETTER_AUTH_SECRET deve ter mínimo 32 chars
 * ⚠️ AIDEV-WARNING: password hash usa PBKDF2 via Web Crypto — necessário para Workers CPU limit
 */
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

// AIDEV-NOTE: PBKDF2 via Web Crypto API — leve o suficiente para Cloudflare Workers
// Workers Free = 10ms CPU. scrypt/bcrypt excedem esse limite.
// PBKDF2 com 100k iterações + SHA-256 é seguro e cabe no budget.
const PBKDF2_ITERATIONS = 100_000;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, 256
  );
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...new Uint8Array(derived)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  const parts = data.hash.split(':');
  if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(parts[2].match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const storedHash = parts[3];
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(data.password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key, 256
  );
  const computedHash = [...new Uint8Array(derived)].map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === storedHash;
}

export function createAuth(env: { DATABASE_URL: string; BETTER_AUTH_SECRET: string }) {
  return betterAuth({
    baseURL: 'https://openwork-auth.script7sistemas.workers.dev',
    secret: env.BETTER_AUTH_SECRET,
    database: new Pool({
      connectionString: env.DATABASE_URL,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    trustedOrigins: [
      'app://openwork',
      'http://localhost',
    ],
    user: {
      additionalFields: {
        plan: {
          type: 'string',
          defaultValue: 'free',
          input: false,
        },
        licenseExpiresAt: {
          type: 'date',
          input: false,
        },
      },
    },
  });
}
