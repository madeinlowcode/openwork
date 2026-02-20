/**
 * @edgeFunction openwork-auth
 * @description Cloudflare Worker que serve como servidor Better Auth para o Openwork.
 *              Gerencia autenticação (signup, login, sessão) e registra uso de tokens.
 *
 * @trigger HTTP (Cloudflare Workers)
 *
 * @environment
 * - DB_HYPERDRIVE (Hyperdrive binding → PostgreSQL)
 * - BETTER_AUTH_SECRET (secret para assinatura de tokens)
 *
 * @dependencies
 * - hono (framework HTTP)
 * - better-auth (autenticação)
 * - pg (PostgreSQL driver)
 *
 * @databaseTables
 * - user, session, account (gerenciadas pelo Better Auth)
 * - openwork_usage (INSERT — registro de uso de tokens)
 *
 * @relatedFiles
 * - src/auth.ts (configuração do Better Auth)
 *
 * ⚠️ AIDEV-WARNING: Função em produção — testar localmente antes de deploy
 * 🔒 AIDEV-SECURITY: Rota /usage/record requer sessão autenticada
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from 'pg';
import { createAuth } from './auth';

export interface Env {
  DB_HYPERDRIVE: Hyperdrive;
  BETTER_AUTH_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['app://openwork', 'http://localhost'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// AIDEV-NOTE: Better Auth gerencia TODAS as rotas /api/auth/* automaticamente
app.on(['GET', 'POST'], '/api/auth/**', async (c) => {
  const auth = createAuth({
    DATABASE_URL: c.env.DB_HYPERDRIVE.connectionString,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
  });
  return auth.handler(c.req.raw);
});

// Rota de health check
app.get('/health', (c) => c.json({ ok: true }));

// AIDEV-NOTE: Rota de registro de uso — fire-and-forget do Electron client
// 🔒 AIDEV-SECURITY: Requer sessão autenticada via Better Auth
app.post('/usage/record', async (c) => {
  const auth = createAuth({
    DATABASE_URL: c.env.DB_HYPERDRIVE.connectionString,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
  });

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ ok: false }, 401);

  const body = await c.req.json();
  const pool = new Pool({ connectionString: c.env.DB_HYPERDRIVE.connectionString });

  try {
    await pool.query(
      'INSERT INTO openwork_usage (user_id, task_id, model_id, provider, input_tokens, output_tokens, cost_usd) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [session.user.id, body.taskId, body.modelId, body.provider, body.inputTokens, body.outputTokens, body.costUsd]
    );
    return c.json({ ok: true });
  } catch (err) {
    console.error('Usage record failed:', err);
    return c.json({ ok: false, error: 'Failed to record usage' }, 500);
  } finally {
    await pool.end();
  }
});

export default app;
