/**
 * @description Testes unitarios para o beta-download-worker.
 *              Usa mocks de KV e R2 para simular bindings do Cloudflare.
 *
 * AIDEV-NOTE: Testes rodam com vitest, sem miniflare — mocks manuais dos bindings
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../index';
import type { Env } from '../index';

// ---- Mock helpers ----

function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiration?: number }>();
  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expiration: opts?.expirationTtl });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function createMockR2(hasFile = true): R2Bucket {
  return {
    get: vi.fn(async () => {
      if (!hasFile) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('fake-binary'));
            controller.close();
          },
        }),
        size: 11,
      };
    }),
    put: vi.fn(),
    delete: vi.fn(),
    head: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    BETA_CODE: 'OPENWORK-BETA-2026',
    BETA_KV: createMockKV(),
    RELEASES: createMockR2(),
    ...overrides,
  };
}

async function makeRequest(
  env: Env,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `http://localhost${path}`;
  const req = new Request(url, options);
  return app.fetch(req, env);
}

// ---- Tests ----

describe('beta-download-worker', () => {
  let env: Env;

  beforeEach(() => {
    env = createEnv();
  });

  describe('GET /health', () => {
    it('retorna 200 com status ok', async () => {
      const res = await makeRequest(env, '/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/validate-beta', () => {
    it('retorna downloadUrl com codigo valido', async () => {
      const res = await makeRequest(env, '/api/validate-beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'OPENWORK-BETA-2026', email: 'test@example.com' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.downloadUrl).toMatch(/^\/api\/download\/.+/);

      // Verifica que email foi registrado no KV
      expect(env.BETA_KV.put).toHaveBeenCalledWith(
        'beta-emails:test@example.com',
        expect.any(String)
      );
    });

    it('retorna 403 com codigo invalido', async () => {
      const res = await makeRequest(env, '/api/validate-beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'INVALID-CODE', email: 'test@example.com' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('retorna 400 sem email', async () => {
      const res = await makeRequest(env, '/api/validate-beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'OPENWORK-BETA-2026' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('retorna 400 com email invalido', async () => {
      const res = await makeRequest(env, '/api/validate-beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'OPENWORK-BETA-2026', email: 'invalid' }),
      });

      expect(res.status).toBe(400);
    });

    it('valida codigo contra lista no KV quando disponivel', async () => {
      // Configura KV com lista customizada
      (env.BETA_KV.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify(['CUSTOM-CODE-1', 'CUSTOM-CODE-2'])
      );

      const res = await makeRequest(env, '/api/validate-beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'CUSTOM-CODE-1', email: 'test@example.com' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('GET /api/download/:token', () => {
    it('retorna 200 com token valido', async () => {
      const token = 'valid-token-123';
      // Simula token existente no KV
      (env.BETA_KV.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({ email: 'test@example.com', createdAt: new Date().toISOString() })
      );

      const res = await makeRequest(env, `/api/download/${token}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Disposition')).toContain('openwork-setup.exe');
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');

      // Verifica que token foi consumido
      expect(env.BETA_KV.delete).toHaveBeenCalledWith(`download-token:${token}`);
    });

    it('retorna 403 com token invalido', async () => {
      const res = await makeRequest(env, '/api/download/invalid-token');
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('retorna 404 quando arquivo nao existe no R2', async () => {
      const token = 'valid-token-456';
      (env.BETA_KV.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({ email: 'test@example.com' })
      );
      env.RELEASES = createMockR2(false);

      const res = await makeRequest(env, `/api/download/${token}`);
      expect(res.status).toBe(404);
    });
  });
});
