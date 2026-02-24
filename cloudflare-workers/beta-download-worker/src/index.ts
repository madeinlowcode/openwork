/**
 * @edgeFunction beta-download-worker
 * @description Cloudflare Worker para validacao de codigos beta e gerenciamento de downloads.
 *              Valida codigos beta contra KV, registra emails e gera tokens temporarios.
 *              O download redireciona para GitHub Releases (madeinlowcode/openwork-releases).
 *
 * @trigger HTTP (Cloudflare Workers)
 *
 * @environment
 * - BETA_CODE (codigo beta padrao)
 * - BETA_KV (KV namespace para codigos, emails e tokens)
 * - GH_RELEASE_URL (URL do asset .exe no GitHub Releases)
 *
 * @dependencies
 * - hono (framework HTTP)
 *
 * @relatedFiles
 * - wrangler.toml (bindings KV)
 *
 * AIDEV-WARNING: Nao fazer deploy sem configurar KV no Cloudflare Dashboard
 * AIDEV-NOTE: Download via redirect para GitHub Releases (sem limite de tamanho)
 * AIDEV-SECURITY: Tokens de download tem TTL de 24h e uso unico
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  BETA_CODE: string;
  BETA_KV: KVNamespace;
  GH_RELEASE_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// AIDEV-NOTE: CORS permissivo para landing page — ajustar origin em producao
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
);

/**
 * @api GET /health
 * @description Health check endpoint
 * @response 200: { status: "ok", timestamp: string }
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @api POST /api/validate-beta
 * @description Valida codigo beta, registra email e gera token de download temporario
 *
 * @requestBody
 * - code: string — codigo beta para validacao
 * - email: string — email do usuario
 *
 * @response
 * - 200: { success: true, downloadUrl: string }
 * - 400: { success: false, error: string }
 * - 403: { success: false, error: string }
 *
 * AIDEV-SECURITY: Validar inputs antes de processar
 */
app.post('/api/validate-beta', async (c) => {
  let body: { code?: string; email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { code, email } = body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return c.json({ success: false, error: 'Valid email is required' }, 400);
  }

  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: 'Beta code is required' }, 400);
  }

  // AIDEV-NOTE: Verifica codigo contra lista no KV, fallback para env var
  let validCodes: string[] = [c.env.BETA_CODE];
  const kvCodes = await c.env.BETA_KV.get('beta-codes');
  if (kvCodes) {
    try {
      const parsed = JSON.parse(kvCodes);
      if (Array.isArray(parsed)) {
        validCodes = parsed;
      }
    } catch {
      // Fallback para codigo da env var
    }
  }

  if (!validCodes.includes(code)) {
    return c.json({ success: false, error: 'Invalid beta code' }, 403);
  }

  // Registra email no KV
  await c.env.BETA_KV.put(
    `beta-emails:${email}`,
    JSON.stringify({ registeredAt: new Date().toISOString(), code })
  );

  // Gera token temporario com TTL de 24h
  const token = crypto.randomUUID();
  await c.env.BETA_KV.put(
    `download-token:${token}`,
    JSON.stringify({ email, createdAt: new Date().toISOString() }),
    { expirationTtl: 86400 } // 24 horas
  );

  return c.json({
    success: true,
    downloadUrl: `/api/download/${token}`,
  });
});

/**
 * @api GET /api/download/:token
 * @description Redireciona para GitHub Releases usando token temporario
 *
 * @response
 * - 302: Redirect para URL do GitHub Releases
 * - 403: { error: string } token invalido ou expirado
 *
 * AIDEV-NOTE: Redirect para GitHub Releases — sem limite de tamanho, CDN global
 * AIDEV-SECURITY: Token e consumido apos uso (single-use)
 */
app.get('/api/download/:token', async (c) => {
  const token = c.req.param('token');

  // Valida token no KV
  const tokenData = await c.env.BETA_KV.get(`download-token:${token}`);
  if (!tokenData) {
    return c.json({ error: 'Invalid or expired download token' }, 403);
  }

  // Consome o token (single-use)
  await c.env.BETA_KV.delete(`download-token:${token}`);

  // AIDEV-NOTE: Redireciona para GitHub Releases (GH_RELEASE_URL definido via wrangler secret/var)
  const releaseUrl = c.env.GH_RELEASE_URL ||
    'https://github.com/madeinlowcode/openwork-releases/releases/latest/download/openwork-setup.exe';

  return Response.redirect(releaseUrl, 302);
});

export default app;
