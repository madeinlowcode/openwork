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
 * - ENVIRONMENT (production | development)
 *
 * @dependencies
 * - hono (framework HTTP)
 * - better-auth (autenticação)
 * - pg (PostgreSQL driver)
 * - zod (validação de schemas)
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
import { z } from 'zod';
import { createAuth } from './auth';

// AIDEV-NOTE: Constant-time comparison para prevenir timing attacks (HMAC)
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new Uint8Array(a.length);
  const bBytes = new Uint8Array(b.length);
  for (let i = 0; i < a.length; i++) aBytes[i] = a.charCodeAt(i);
  for (let i = 0; i < b.length; i++) bBytes[i] = b.charCodeAt(i);

  let result = 0;
  for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i++) {
    const aByte = i < aBytes.length ? aBytes[i] : 0;
    const bByte = i < bBytes.length ? bBytes[i] : 0;
    result |= aByte ^ bByte;
  }
  return result === 0;
}

// AIDEV-NOTE: Rate limiting — 5 tentativas/15min por IP
// ⚠️ AIDEV-WARNING: Em produção com múltiplos workers, usar Rate Limiting do Cloudflare
const rateLimitMap = new Map<string, { attempts: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function rateLimit(c: { req: { header: (h: string) => string | null } }): boolean {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { attempts: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    return false;
  }

  entry.attempts++;
  return true;
}

// AIDEV-NOTE: Pool global reutilizado por isolate — otimização de performance
// ⚠️ AIDEV-WARNING: Cloudflare Workers isolates são efêmeros, pool é por isolate
// Em produção com Durable Objects, implementar pool compartilhado
const poolCache = new Map<string, Pool>();

function getPool(connectionString: string): Pool {
  let pool = poolCache.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString });
    poolCache.set(connectionString, pool);
  }
  return pool;
}

export interface Env {
  DB_HYPERDRIVE: Hyperdrive;
  BETTER_AUTH_SECRET: string;
  ENVIRONMENT?: string;
}

const app = new Hono<{ Bindings: Env }>();

// AIDEV-NOTE: Rate limiting removido do middleware global — agora aplicado apenas ao sign-in

// AIDEV-NOTE: CORS dinâmico baseado em ENVIRONMENT
// Produção: apenas app://openwork | Desenvolvimento: inclui http://localhost
// AIDEV-SECURITY: Default to production (safe) — only allow localhost in explicit dev mode
const getCorsOrigin = (env: string | undefined) => {
  if (env === 'development') {
    return ['app://openwork', 'http://localhost'];
  }
  return ['app://openwork'];
};

app.use('*', cors((c) => ({
  origin: getCorsOrigin(c.env.ENVIRONMENT),
  allowHeaders: ['Content-Type', 'Authorization', 'X-App-Signature', 'X-App-Timestamp'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
})));

// AIDEV-NOTE: Schema Zod para validação de registro de uso
// 🔒 AIDEV-SECURITY: Validação obrigatória de inputs no endpoint
const usageRecordSchema = z.object({
  taskId: z.string().min(1),
  modelId: z.string().min(1),
  provider: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
});

// AIDEV-NOTE: Better Auth gerencia TODAS as rotas /api/auth/* automaticamente
app.on(['GET', 'POST'], '/api/auth/**', async (c) => {
  // AIDEV-SECURITY: Rate limit only sign-in attempts — not all auth routes
  if (c.req.method === 'POST' && c.req.url.includes('/sign-in')) {
    if (!rateLimit(c)) {
      return c.json({ error: 'Too many login attempts', retryAfter: 900 }, 429);
    }
  }

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
// 🔒 AIDEV-SECURITY: Validação Zod obrigatória para prevenir dados maliciosos
app.post('/usage/record', async (c) => {
  const auth = createAuth({
    DATABASE_URL: c.env.DB_HYPERDRIVE.connectionString,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
  });

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ ok: false }, 401);

  // AIDEV-NOTE: Parse e validação Zod do body
  const parseResult = usageRecordSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ ok: false, error: 'Invalid request body', details: parseResult.error.issues }, 400);
  }

  const body = parseResult.data;
  // AIDEV-NOTE: Usa pool reutilizado — não faz pool.end() para manter conexões
  const pool = getPool(c.env.DB_HYPERDRIVE.connectionString);

  try {
    await pool.query(
      'INSERT INTO openwork_usage (user_id, task_id, model_id, provider, input_tokens, output_tokens, cost_usd) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [session.user.id, body.taskId, body.modelId, body.provider, body.inputTokens, body.outputTokens, body.costUsd]
    );

    // AIDEV-SECURITY: Detectar anomalias apos registrar uso — flaggeia se 5x do limite
    // Busca plano do usuario para determinar threshold
    const userResult = await pool.query('SELECT plan FROM users WHERE id = $1', [session.user.id]);
    const userPlan = userResult.rows[0]?.plan || 'free';
    const planLimit = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
    if (planLimit !== Infinity) {
      await flagAnomaly(pool, session.user.id, planLimit);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error('Usage record failed:', err);
    return c.json({ ok: false, error: 'Failed to record usage' }, 500);
  }
  // AIDEV-NOTE: Sem finally + pool.end() — pool é reutilizado
});

// ============================================================================
// FASE 5: Server-side enforcement (Tasks 13-18)
// ============================================================================

// Task 13: Query helper para uso mensal
async function getMonthlyUsage(pool: Pool, userId: string, year: number, month: number) {
  const result = await pool.query(
    `SELECT
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(cost_usd), 0) as cost_usd,
      COUNT(*) as task_count
    FROM openwork_usage
    WHERE user_id = $1
      AND EXTRACT(YEAR FROM recorded_at) = $2
      AND EXTRACT(MONTH FROM recorded_at) = $3`,
    [userId, year, month]
  );
  return result.rows[0];
}

// Task 14: Middleware de validação de plano
// Limites: free=500 tasks/mês, pro=5000 tasks/mês, enterprise=sem limite
const PLAN_LIMITS: Record<string, number> = {
  free: 500,
  pro: 5000,
  enterprise: Infinity,
};

async function requireActivePlan(
  pool: Pool,
  userId: string
): Promise<{ allowed: boolean; plan?: string; remaining?: number; error?: string }> {
  // Busca plano do usuário
  const userResult = await pool.query(
    'SELECT plan, license_expires_at FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return { allowed: false, error: 'User not found' };
  }

  const user = userResult.rows[0];
  const plan = user.plan || 'free';

  // Verifica se licença expirou
  if (user.license_expires_at && new Date(user.license_expires_at) < new Date()) {
    return { allowed: false, error: 'License expired' };
  }

  // Enterprise não tem limite
  if (plan === 'enterprise') {
    return { allowed: true, plan, remaining: Infinity };
  }

  // Verifica limite mensal
  const now = new Date();
  const usage = await getMonthlyUsage(pool, userId, now.getFullYear(), now.getMonth() + 1);
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const remaining = limit - (usage.task_count || 0);

  if (remaining <= 0) {
    return { allowed: false, plan, remaining: 0, error: 'Monthly limit exceeded' };
  }

  return { allowed: true, plan, remaining };
}

// Task 18: Detecção de anomalias - verifica se usuário tem flags ativas
async function checkUserFlags(pool: Pool, userId: string): Promise<{ flagged: boolean; flags: string[] }> {
  const result = await pool.query(
    `SELECT flag_type, reason FROM user_flags
     WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { flagged: false, flags: [] };
  }

  return {
    flagged: true,
    flags: result.rows.map((r) => r.flag_type),
  };
}

// Task 18: Flag de anomalia quando 5x do limite
async function flagAnomaly(pool: Pool, userId: string, threshold: number) {
  const now = new Date();
  const usage = await getMonthlyUsage(pool, userId, now.getFullYear(), now.getMonth() + 1);
  const taskCount = usage.task_count || 0;

  // Flag se 5x do limite
  if (taskCount >= threshold * 5) {
    await pool.query(
      `INSERT INTO user_flags (user_id, flag_type, reason, expires_at)
       VALUES ($1, 'anomaly_detected', $2, NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING`,
      [userId, `Exceeded 5x monthly limit: ${taskCount} tasks`]
    );
  }
}

// Task 15: Endpoint /api/task/authorize - gate server-side antes de executar task
const taskAuthorizeSchema = z.object({
  taskId: z.string().min(1),
  estimatedTokens: z.number().int().min(0).optional(),
});

app.post('/api/task/authorize', async (c) => {
  const auth = createAuth({
    DATABASE_URL: c.env.DB_HYPERDRIVE.connectionString,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
  });

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ authorized: false, error: 'Unauthorized' }, 401);

  // Valida input
  const parseResult = taskAuthorizeSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ authorized: false, error: 'Invalid request' }, 400);
  }

  const pool = getPool(c.env.DB_HYPERDRIVE.connectionString);

  // Task 18: Verifica flags de anomalia primeiro
  const flags = await checkUserFlags(pool, session.user.id);
  if (flags.flagged) {
    return c.json({ authorized: false, error: 'Account flagged', flags: flags.flags }, 403);
  }

  // Task 14: Valida plano e limites
  const planCheck = await requireActivePlan(pool, session.user.id);
  if (!planCheck.allowed) {
    return c.json({ authorized: false, error: planCheck.error, plan: planCheck.plan }, 403);
  }

  return c.json({
    authorized: true,
    plan: planCheck.plan,
    remaining: planCheck.remaining,
  });
});

// Task 16: Endpoint /api/user/usage - dashboard de uso para o cliente
app.get('/api/user/usage', async (c) => {
  const auth = createAuth({
    DATABASE_URL: c.env.DB_HYPERDRIVE.connectionString,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
  });

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const pool = getPool(c.env.DB_HYPERDRIVE.connectionString);
  const now = new Date();

  // Uso do mês atual
  const currentMonth = await getMonthlyUsage(pool, session.user.id, now.getFullYear(), now.getMonth() + 1);

  // Uso dos últimos 3 meses
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const historyResult = await pool.query(
    `SELECT
      EXTRACT(YEAR FROM recorded_at) as year,
      EXTRACT(MONTH FROM recorded_at) as month,
      COUNT(*) as task_count,
      COALESCE(SUM(cost_usd), 0) as cost_usd
    FROM openwork_usage
    WHERE user_id = $1 AND recorded_at >= $2
    GROUP BY EXTRACT(YEAR FROM recorded_at), EXTRACT(MONTH FROM recorded_at)
    ORDER BY year DESC, month DESC`,
    [session.user.id, threeMonthsAgo]
  );

  // Limite do plano
  const userResult = await pool.query('SELECT plan FROM users WHERE id = $1', [session.user.id]);
  const plan = userResult.rows[0]?.plan || 'free';
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  return c.json({
    current: {
      tasks: currentMonth.task_count || 0,
      inputTokens: parseInt(currentMonth.input_tokens) || 0,
      outputTokens: parseInt(currentMonth.output_tokens) || 0,
      costUsd: parseFloat(currentMonth.cost_usd) || 0,
    },
    limit,
    plan,
    history: historyResult.rows,
  });
});

// Task 17: HMAC signing - middleware para validar assinatura HMAC
function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const encoder = new TextEncoder();
  const key = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(payload)).then((sig) => {
    const sigArray = new Uint8Array(sig);
    const sigHex = [...sigArray].map((b) => b.toString(16).padStart(2, '0')).join('');
    return timingSafeEqual(sigHex, signature);
  });
}

// Task 17: Schema para request com HMAC
const hmacAuthorizedSchema = z.object({
  payload: z.string(),
  signature: z.string(),
});

// Task 17: Endpoint exemplo que usa HMAC (para webhooks)
app.post('/api/webhook/verify', async (c) => {
  const parseResult = hmacAuthorizedSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ valid: false, error: 'Invalid request' }, 400);
  }

  const { payload, signature } = parseResult.data;
  const secret = c.env.BETTER_AUTH_SECRET; // Em produção, usar secret específico

  const isValid = await verifyHmacSignature(payload, signature, secret);
  return c.json({ valid: isValid });
});

// Task 18: Revogar sessão de usuário flaggeado
app.post('/api/admin/revoke-flagged', async (c) => {
  // AIDEV-NOTE: Endpoint admin - em produção, adicionar verificação de role admin
  const auth = createAuth({
    DATABASE_URL: c.env.DB_HYPERDRIVE.connectionString,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
  });

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const pool = getPool(c.env.DB_HYPERDRIVE.connectionString);

  // Busca todos usuários com flag de anomalia
  const flaggedUsers = await pool.query(
    `SELECT user_id FROM user_flags
     WHERE flag_type = 'anomaly_detected'
     AND (expires_at IS NULL OR expires_at > NOW())`
  );

  // Revoga todas sessões desses usuários
  for (const user of flaggedUsers.rows) {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.user_id]);

    // Adiciona flag de sessão revogada
    await pool.query(
      `INSERT INTO user_flags (user_id, flag_type, reason, expires_at)
       VALUES ($1, 'session_revoked', 'Automatic revocation due to anomaly', NOW() + INTERVAL '1 hour')
       ON CONFLICT DO NOTHING`,
      [user.user_id]
    );
  }

  return c.json({ revoked: flaggedUsers.rows.length });
});

export default app;
