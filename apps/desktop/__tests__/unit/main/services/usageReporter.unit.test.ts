/**
 * @module __tests__/unit/main/services/usageReporter.unit.test
 * @description Testes unitarios para usage-reporter (fire-and-forget).
 * Valida que fetch e chamado apenas quando ha sessao, e que erros sao silenciados.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth-client — use vi.hoisted to avoid TDZ
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@main/lib/auth-client', () => ({
  authClient: {
    getSession: mockGetSession,
  },
  WORKER_URL: 'https://mock-worker.example.com',
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { reportUsageAsync } from '@main/services/usage-reporter';
import type { UsageReportData } from '@main/services/usage-reporter';

const sampleData: UsageReportData = {
  taskId: 'task-123',
  modelId: 'claude-sonnet-4-20250514',
  provider: 'anthropic',
  inputTokens: 1000,
  outputTokens: 500,
  costUsd: 0.015,
};

describe('usageReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch with correct URL when session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: 'u1' } } });

    reportUsageAsync(sampleData);

    // Wait for the promise chain to resolve
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mock-worker.example.com/usage/record',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleData),
      })
    );
  });

  it('does NOT call fetch when session is null', async () => {
    mockGetSession.mockResolvedValue(null);

    reportUsageAsync(sampleData);

    // Give promise chain time to resolve
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does NOT call fetch when session.data is falsy', async () => {
    mockGetSession.mockResolvedValue({ data: null });

    reportUsageAsync(sampleData);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when fetch rejects (fire-and-forget)', async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFetch.mockRejectedValue(new Error('Network error'));

    // Should not throw
    expect(() => reportUsageAsync(sampleData)).not.toThrow();

    // Wait for async chain
    await new Promise((r) => setTimeout(r, 50));
  });

  it('does not throw when getSession rejects', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth error'));

    expect(() => reportUsageAsync(sampleData)).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns void immediately (non-blocking)', () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const result = reportUsageAsync(sampleData);
    expect(result).toBeUndefined();
  });
});
