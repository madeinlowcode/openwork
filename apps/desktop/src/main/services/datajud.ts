/**
 * DataJud API Service
 *
 * @description HTTP client for CNJ DataJud API (National Database of the Judiciary)
 * @see https://api-publica.datajud.cnj.jus.br/
 *
 * @context Main process service for searching Brazilian judiciary processes
 *
 * @dependencies
 * - packages/shared/src/types/datajud.ts (DataJudQuery, DataJudProcess, DataJudError, etc.)
 * - apps/desktop/src/main/store/secureStorage.ts (getApiKey, storeApiKey)
 * - apps/desktop/src/main/utils/redact.ts (redactDataJudKey)
 *
 * @usedBy
 * - apps/desktop/src/main/mcp/datajud-server.ts
 * - apps/desktop/src/main/ipc/datajud-handlers.ts
 *
 * ⚠️ AIDEV-WARNING: API key must be retrieved from secure storage, never hardcoded
 * 🔒 AIDEV-SECURITY: All API keys in logs are redacted via redactDataJudKey()
 */

import type {
  DataJudQuery,
  DataJudSearchResult,
  DataJudProcess,
  DataJudSearchFilters,
  DataJudQueryType,
  DataJudError,
  DataJudProceduralClass,
  DataJudMovement,
  DataJudParty,
  DataJudPagination,
  DataJudInstance,
  DataJudSigiloLevel,
} from '@accomplish/shared';
import { DataJudError as DataJudTypedError } from '@accomplish/shared';
import {
  getDataJudApiKey,
  setDataJudApiKey,
  hasDataJudApiKey,
  deleteDataJudApiKey,
} from '../store/secureStorage';

// =============================================================================
// Configuration
// =============================================================================

/**
 * DataJud API base URL
 */
const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';

/**
 * Request timeouts in milliseconds
 */
export const DATAJUD_TIMEOUTS = {
  /** Timeout for API key validation request */
  validation: 10_000,
  /** Timeout for normal search requests */
  search: 30_000,
  /** Timeout for large result set requests (size > 1000) */
  largeSearch: 60_000,
} as const;

/**
 * Retry configuration
 */
export const DATAJUD_RETRY_CONFIG = {
  /** Maximum retry attempts */
  maxRetries: 3,
  /** Initial delay in milliseconds */
  initialDelay: 1_000,
  /** Backoff multiplier (1s, 2s, 4s) */
  backoffMultiplier: 2,
  /** HTTP status codes that trigger retry */
  retryableStatusCodes: [408, 429, 500, 502, 503, 504] as const,
} as const;

/**
 * Rate limiting configuration
 */
export const DATAJUD_RATE_LIMIT = {
  /** Maximum requests per minute */
  requestsPerMinute: 60,
  /** Minimum interval between requests in milliseconds */
  minIntervalMs: 1_000,
} as const;

/**
 * Cache TTL configuration in milliseconds
 */
export const DATAJUD_CACHE_TTL = {
  /** Cache TTL for number-based searches (processes don't change often) */
  numberSearch: 5 * 60 * 1_000, // 5 minutes
  /** Cache TTL for generic searches */
  genericSearch: 1 * 60 * 1_000, // 1 minute
} as const;

// =============================================================================
// Court Information
// =============================================================================

/**
 * Supported courts with their aliases and categories
 */
export const DATAJUD_COURTS: DataJudCourt[] = [
  // Superior Courts
  { alias: 'api_publica_stj', name: 'Superior Tribunal de Justiça', category: 'superior', isActive: true },
  { alias: 'api_publica_tst', name: 'Tribunal Superior do Trabalho', category: 'superior', isActive: true },
  { alias: 'api_publica_tse', name: 'Tribunal Superior Eleitoral', category: 'superior', isActive: true },
  { alias: 'api_publica_stm', name: 'Tribunal Superior Militar', category: 'superior', isActive: true },

  // Regional Federal Courts
  { alias: 'api_publica_trf1', name: 'Tribunal Regional Federal da 1ª Região', category: 'federal', state: 'DF', isActive: true },
  { alias: 'api_publica_trf2', name: 'Tribunal Regional Federal da 2ª Região', category: 'federal', state: 'RJ', isActive: true },
  { alias: 'api_publica_trf3', name: 'Tribunal Regional Federal da 3ª Região', category: 'federal', state: 'SP', isActive: true },
  { alias: 'api_publica_trf4', name: 'Tribunal Regional Federal da 4ª Região', category: 'federal', state: 'RS', isActive: true },
  { alias: 'api_publica_trf5', name: 'Tribunal Regional Federal da 5ª Região', category: 'federal', state: 'PE', isActive: true },
  { alias: 'api_publica_trf6', name: 'Tribunal Regional Federal da 6ª Região', category: 'federal', state: 'PR', isActive: true },

  // State Courts (sample - would need full list)
  { alias: 'tjsp', name: 'Tribunal de Justiça de São Paulo', category: 'state', state: 'SP', isActive: true },
  { alias: 'tjrj', name: 'Tribunal de Justiça do Rio de Janeiro', category: 'state', state: 'RJ', isActive: true },
  { alias: 'tjmg', name: 'Tribunal de Justiça de Minas Gerais', category: 'state', state: 'MG', isActive: true },
  { alias: 'tjba', name: 'Tribunal de Justiça da Bahia', category: 'state', state: 'BA', isActive: true },
  { alias: 'tjrs', name: 'Tribunal de Justiça do Rio Grande do Sul', category: 'state', state: 'RS', isActive: true },
  { alias: 'tjpr', name: 'Tribunal de Justiça do Paraná', category: 'state', state: 'PR', isActive: true },
  { alias: 'tjsc', name: 'Tribunal de Justiça de Santa Catarina', category: 'state', state: 'SC', isActive: true },
  { alias: 'tjce', name: 'Tribunal de Justiça do Ceará', category: 'state', state: 'CE', isActive: true },
  { alias: 'tjpe', name: 'Tribunal de Justiça de Pernambuco', category: 'state', state: 'PE', isActive: true },
  { alias: 'tjgo', name: 'Tribunal de Justiça de Goiás', category: 'state', state: 'GO', isActive: true },

  // Labor Courts (sample)
  { alias: 'trt1', name: 'Tribunal Regional do Trabalho da 1ª Região', category: 'labor', state: 'RJ', isActive: true },
  { alias: 'trt2', name: 'Tribunal Regional do Trabalho da 2ª Região', category: 'labor', state: 'SP', isActive: true },
  { alias: 'trt3', name: 'Tribunal Regional do Trabalho da 3ª Região', category: 'labor', state: 'MG', isActive: true },
  { alias: 'trt4', name: 'Tribunal Regional do Trabalho da 4ª Região', category: 'labor', state: 'RS', isActive: true },
];

/**
 * Court information interface for exports
 */
interface DataJudCourt {
  alias: string;
  name: string;
  category: 'superior' | 'federal' | 'state' | 'labor' | 'electoral' | 'military';
  state?: string;
  isActive: boolean;
}

// =============================================================================
// In-Memory Cache
// =============================================================================

interface CacheEntry {
  data: DataJudSearchResult;
  timestamp: number;
}

/**
 * In-memory cache for search results
 */
const searchCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(query: DataJudQuery): string {
  return JSON.stringify(query);
}

/**
 * Get cached result if available and not expired
 */
function getCachedResult(query: DataJudQuery): DataJudSearchResult | null {
  const cacheKey = generateCacheKey(query);
  const entry = searchCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  const ttl = query.queryType === 'number' ? DATAJUD_CACHE_TTL.numberSearch : DATAJUD_CACHE_TTL.genericSearch;
  const isExpired = Date.now() - entry.timestamp > ttl;

  if (isExpired) {
    searchCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

/**
 * Store result in cache
 */
function cacheResult(query: DataJudQuery, result: DataJudSearchResult): void {
  const cacheKey = generateCacheKey(query);
  searchCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });
}

/**
 * Clear all cached results
 */
export function clearSearchCache(): void {
  searchCache.clear();
  console.log('[DataJud] Search cache cleared');
}

// =============================================================================
// Rate Limiting
// =============================================================================

interface RateLimitEntry {
  timestamp: number;
}

/**
 * In-memory rate limiter
 */
const requestHistory: RateLimitEntry[] = [];
let lastRequestTime = 0;

/**
 * Check if request should be rate limited
 */
function checkRateLimit(): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  const windowMs = 60 * 1_000; // 1 minute window

  // Remove old entries outside the window
  while (requestHistory.length > 0 && requestHistory[0].timestamp < now - windowMs) {
    requestHistory.shift();
  }

  // Check if we're at the limit
  if (requestHistory.length >= DATAJUD_RATE_LIMIT.requestsPerMinute) {
    const oldestInWindow = requestHistory[0];
    const waitMs = oldestInWindow ? (oldestInWindow.timestamp + windowMs) - now : DATAJUD_RATE_LIMIT.minIntervalMs;
    return { allowed: false, waitMs: Math.max(waitMs, DATAJUD_RATE_LIMIT.minIntervalMs) };
  }

  // Check minimum interval between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < DATAJUD_RATE_LIMIT.minIntervalMs) {
    return { allowed: false, waitMs: DATAJUD_RATE_LIMIT.minIntervalMs - timeSinceLastRequest };
  }

  return { allowed: true, waitMs: 0 };
}

/**
 * Record a request for rate limiting
 */
function recordRequest(): void {
  const now = Date.now();
  requestHistory.push({ timestamp: now });
  lastRequestTime = now;
}

/**
 * Wait for rate limit to clear
 */
async function waitForRateLimit(): Promise<void> {
  const { allowed, waitMs } = checkRateLimit();
  if (!allowed && waitMs > 0) {
    console.log(`[DataJud] Rate limit active, waiting ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

// =============================================================================
// Log Redaction
// =============================================================================

/**
 * Redact API key from log messages
 * AIDEV-SECURITY: Never expose API key in logs
 */
import { redactDataJudKey, createDataJudLogger } from '../utils/datajud-redact';

const logger = createDataJudLogger('service');

function redactLog(text: string): string {
  return redactDataJudKey(text);
}

// =============================================================================
// HTTP Utilities
// =============================================================================

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Query Builders
// =============================================================================

/**
 * Build Elasticsearch query body for different search types
 * @internal - Exported for testing purposes
 */
export function buildSearchQuery(query: DataJudQuery): Record<string, unknown> {
  const { queryType, value, size = 10, filters } = query;

  // Base query with size
  const baseQuery: Record<string, unknown> = {
    size: Math.min(size, 10_000), // API limit
  };

  // Build type-specific query
  switch (queryType) {
    case 'number': {
      // Search by CNJ process number (format: 0000000-00.0000.0.00.0000)
      // Remove all non-alphanumeric characters for matching
      const cleanNumber = value.replace(/[^0-9]/g, '');
      baseQuery.query = {
        match: { numeroProcesso: cleanNumber },
      };
      break;
    }

    case 'class': {
      // Search by procedural class (TPU code)
      // Can also include date range filters
      const must: Record<string, unknown>[] = [{ match: { 'classe.codigo': value } }];
      const filter: Record<string, unknown>[] = [];

      if (filters?.dateFrom || filters?.dateTo) {
        const range: Record<string, unknown> = {};
        if (filters.dateFrom) range.gte = filters.dateFrom;
        if (filters.dateTo) range.lte = filters.dateTo;
        filter.push({ range: { dataAjuizamento: range } });
      }

      if (filters?.instance) {
        filter.push({ term: { grau: filters.instance } });
      }

      baseQuery.query = {
        bool: {
          must,
          filter,
        },
      };
      break;
    }

    case 'party': {
      // Search by party name (author, defendant, lawyer)
      baseQuery.query = {
        match: { 'partes.nome': value },
      };
      break;
    }

    case 'date_range': {
      // Search by filing date range
      const must: Record<string, unknown>[] = [{ match_all: {} }];
      const filter: Record<string, unknown>[] = [];

      if (filters?.dateFrom || filters?.dateTo) {
        const range: Record<string, unknown> = {};
        if (filters.dateFrom) range.gte = filters.dateFrom;
        if (filters.dateTo) range.lte = filters.dateTo;
        filter.push({ range: { dataAjuizamento: range } });
      }

      if (filters?.instance) {
        filter.push({ term: { grau: filters.instance } });
      }

      baseQuery.query = {
        bool: {
          must,
          filter,
        },
      };
      break;
    }
  }

  // AIDEV-NOTE: API DataJud não suporta sort nem search_after - fielddata bloqueado no cluster

  return baseQuery;
}

/**
 * Validate process number format
 */
/**
 * Validate CNJ process number format
 * @internal - Exported for testing purposes
 */
export function validateProcessNumber(value: string): { valid: boolean; cleaned?: string; error?: string } {
  // CNJ process number format: NNNNNNN-DD.AAAA.J.TR.OOOO (20 numeric digits)
  // We accept both formatted and unformatted versions
  const cleaned = value.replace(/[^0-9]/g, '');

  if (cleaned.length !== 20) {
    return {
      valid: false,
      cleaned,
      error: `Invalid process number format. Expected 20 digits, got ${cleaned.length}`,
    };
  }

  return { valid: true, cleaned };
}

// =============================================================================
// Response Parsers
// =============================================================================

/**
 * Parse API response into structured result
 */
/**
 * Parse Elasticsearch API response into structured format
 * @internal - Exported for testing purposes
 */
export function parseApiResponse(
  response: Record<string, unknown>,
  query: DataJudQuery,
  durationMs: number
): DataJudSearchResult {
  const hits = response.hits as Record<string, unknown> | undefined;
  const total = hits?.total as Record<string, unknown> | undefined;
  const hitsArray = (hits?.hits as Array<Record<string, unknown>> | undefined) || [];

  const processes: DataJudProcess[] = hitsArray.map((hit) => {
    const source = hit._source as Record<string, unknown> | undefined;

    return {
      numeroProcesso: (source?.numeroProcesso as string) || '',
      classe: parseProceduralClass(source?.classe as Record<string, unknown>),
      tribunal: (source?.tribunal as string) || '',
      grau: (source?.grau as DataJudInstance) || 'G1',
      dataAjuizamento: (source?.dataAjuizamento as string) || '',
      orgaoJulgador: parseOrgaoJulgador(source?.orgaoJulgador as Record<string, unknown>),
      // AIDEV-NOTE: Campos mapeados conforme resposta real da API DataJud
      temas: parseTemas((source?.assuntos || source?.temas) as Array<Record<string, unknown>> | undefined),
      partes: parsePartes(source?.partes as Array<Record<string, unknown>> | undefined),
      movimentacoes: parseMovimentacoes((source?.movimentos || source?.movimentacoes) as Array<Record<string, unknown>> | undefined),
      nivelSigilo: (source?.nivelSigilo as DataJudSigiloLevel) || 0,
      dataUltimaAtualizacao: (source?.dataHoraUltimaAtualizacao as string) || (source?.dataUltimaAtualizacao as string) || undefined,
    };
  });

  const totalValue = (total?.value as number) || 0;

  // Parse search_after for next page cursor
  let nextCursor: string[] | undefined;
  if (hitsArray.length > 0) {
    const lastHit = hitsArray[hitsArray.length - 1];
    const sortValue = lastHit.sort as string[] | undefined;
    if (sortValue && sortValue.length > 0) {
      nextCursor = sortValue;
    }
  }

  const pagination: DataJudPagination = {
    total: totalValue,
    size: processes.length,
    nextCursor,
    hasMore: nextCursor !== undefined || processes.length < totalValue,
  };

  return {
    processes,
    pagination,
    metadata: {
      query,
      searchedAt: new Date().toISOString(),
      durationMs,
    },
  };
}

function parseProceduralClass(data: Record<string, unknown> | undefined): DataJudProceduralClass {
  return {
    codigo: (data?.codigo as string) || '',
    nome: (data?.nome as string) || '',
  };
}

function parseOrgaoJulgador(data: Record<string, unknown> | undefined): { codigo: string; nome: string } | undefined {
  if (!data) return undefined;
  return {
    codigo: (data.codigo as string) || '',
    nome: (data.nome as string) || '',
  };
}

function parseTemas(data: Array<Record<string, unknown>> | undefined): Array<{ codigo: string; nome: string }> | undefined {
  if (!data) return undefined;
  return data.map((t) => ({
    codigo: (t.codigo as string) || '',
    nome: (t.nome as string) || '',
  }));
}

function parsePartes(data: Array<Record<string, unknown>> | undefined): DataJudParty[] | undefined {
  if (!data) return undefined;
  return data.map((p, index) => ({
    tipo: (p.tipo as string) || '',
    nome: (p.nome as string) || '',
    documento: p.documento as string | undefined,
    isLead: index === 0, // First party is typically the lead
  }));
}

function parseMovimentacoes(data: Array<Record<string, unknown>> | undefined): DataJudMovement[] | undefined {
  if (!data) return undefined;
  // AIDEV-NOTE: Campos reais da API DataJud: nome, codigo, dataHora, complementosTabelados
  return data.map((m) => ({
    dataMovimentacao: (m.dataHora as string) || (m.dataMovimentacao as string) || '',
    codigoTipoMovimento: (m.codigo as number) || (m.codigoTipoMovimento as number) || 0,
    tipoMovimento: (m.nome as string) || (m.tipoMovimento as string) || '',
    descricaoMovimento: (m.descricaoMovimento as string) || '',
  }));
}

// =============================================================================
// Privacy Filter
// =============================================================================

/**
 * Check and apply confidentiality level to process
 * AIDEV-PRIVACY: nivelSigilo > 0 processes have restricted data
 */
/**
 * Apply privacy filter based on sigilo level
 * @internal - Exported for testing purposes
 */
export function applyPrivacyFilter(process: DataJudProcess): DataJudProcess {
  if (process.nivelSigilo === 0) {
    return process;
  }

  // Process has confidentiality level > 0
  // Return process with sensitive data redacted
  return {
    ...process,
    partes: [], // Remove parties for sigilo processes
    movimentacoes: [], // Remove movements for sigilo processes
  };
}

/**
 * Check if a result has confidentiality restrictions
 */
function hasSigiloRestriction(process: DataJudProcess): boolean {
  return process.nivelSigilo > 0;
}

// =============================================================================
// API Key Management
// =============================================================================

/**
 * Get the configured DataJud API key
 */
export function getDataJudApiKeyStored(): string | null {
  const key = getDataJudApiKey();
  return key && key.trim() ? key : null;
}

/**
 * Check if DataJud is configured
 */
export function isDataJudConfigured(): boolean {
  return hasDataJudApiKey();
}

/**
 * Store DataJud API key
 */
export function setDataJudApiKeyStored(apiKey: string): void {
  setDataJudApiKey(apiKey.trim());
}

/**
 * Delete DataJud API key from storage
 */
export function deleteDataJudApiKeyStored(): boolean {
  return deleteDataJudApiKey();
}

/**
 * Validate API key by making a test request
 */
export async function validateApiKey(apiKey?: string): Promise<{ valid: boolean; error?: string }> {
  const key = apiKey || getDataJudApiKey();

  if (!key || !key.trim()) {
    return { valid: false, error: 'API key is required' };
  }

  try {
    // Test query to STJ (always available)
    const testQuery = { size: 1, query: { match_all: {} } };

    console.log('[DataJud] Validating API key...');

    const response = await fetchWithTimeout(
      `${DATAJUD_BASE_URL}/api_publica_stj/_search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testQuery),
      },
      DATAJUD_TIMEOUTS.validation
    );

    if (response.ok) {
      const responseData = await response.json().catch(() => ({}));
      if (responseData && typeof responseData.hits === 'object') {
        console.log('[DataJud] API key validation successful');
        return { valid: true };
      }
      return { valid: false, error: 'Invalid response from DataJud API' };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key. Please check your DataJud API key.' };
    }

    const errorText = await response.text().catch(() => '');
    console.error('[DataJud] Validation error:', redactLog(errorText.substring(0, 500)));
    return { valid: false, error: `API error (${response.status}): Validation failed` };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: 'Validation timed out. Please check your internet connection.' };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJud] Validation error:', redactLog(message));
    return { valid: false, error: `Network error: ${message}` };
  }
}

// =============================================================================
// Main Search Function
// =============================================================================

/**
 * Perform a search on the DataJud API
 *
 * @param query - Search query parameters
 * @returns Search result with processes and pagination info
 *
 * @throws DataJudError on API errors
 */
export async function search(query: DataJudQuery): Promise<DataJudSearchResult> {
  const apiKey = getDataJudApiKeyStored();

  if (!apiKey) {
    throw new DataJudTypedError(
      'DataJud API key is not configured. Please add it in settings.',
      'AUTH'
    );
  }

  // Check cache first
  const cached = getCachedResult(query);
  if (cached) {
    console.log('[DataJud] Cache hit for query:', redactLog(JSON.stringify(query)));
    return cached;
  }

  // Check rate limit
  await waitForRateLimit();
  recordRequest();

  // AIDEV-NOTE: Normaliza court para alias da API (ex: 'tjsp' -> 'api_publica_tjsp')
  const courtAlias = query.court.startsWith('api_publica_') ? query.court : `api_publica_${query.court}`;
  const url = `${DATAJUD_BASE_URL}/${courtAlias}/_search`;
  const queryBody = buildSearchQuery(query);
  const timeout = (query.size || 10) > 1000 ? DATAJUD_TIMEOUTS.largeSearch : DATAJUD_TIMEOUTS.search;

  console.log('[DataJud] ===== REQUEST DEBUG =====');
  console.log('[DataJud] URL:', url);
  console.log('[DataJud] Body:', JSON.stringify(queryBody, null, 2));
  console.log('[DataJud] API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
  console.log('[DataJud] Query params:', JSON.stringify({ court: query.court, courtAlias, queryType: query.queryType, value: query.value, size: query.size }));
  console.log('[DataJud] ========================');

  let lastError: Error | null = null;
  let delay = DATAJUD_RETRY_CONFIG.initialDelay;

  for (let attempt = 0; attempt <= DATAJUD_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      }, timeout);

      const durationMs = Date.now() - startTime;

      console.log('[DataJud] ===== RESPONSE DEBUG =====');
      console.log('[DataJud] Status:', response.status);
      const responseClone = response.clone();
      const rawText = await responseClone.text().catch(() => '');
      console.log('[DataJud] Response (first 500 chars):', rawText.substring(0, 500));
      console.log('[DataJud] ============================');

      // Handle rate limiting
      if (response.status === 429) {
        console.warn(`[DataJud] Rate limited (attempt ${attempt + 1}), waiting ${delay}ms`);
        await sleep(delay);
        delay *= DATAJUD_RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      // Handle other retryable errors
      const statusCode: number = response.status;
      if ((DATAJUD_RETRY_CONFIG.retryableStatusCodes as readonly number[]).includes(statusCode)) {
        console.warn(`[DataJud] Retryable error ${response.status} (attempt ${attempt + 1}), waiting ${delay}ms`);
        await sleep(delay);
        delay *= DATAJUD_RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new DataJudTypedError(
          'Invalid or unauthorized DataJud API key. Please check your settings.',
          'AUTH',
          response.status
        );
      }

      // Handle client errors
      if (response.status === 400) {
        const errorText = await response.text().catch(() => '');
        throw new DataJudTypedError(
          `Invalid query: ${errorText.substring(0, 200)}`,
          'INVALID_QUERY',
          response.status
        );
      }

      // Handle server errors
      if (response.status >= 500) {
        console.error(`[DataJud] Server error ${response.status} (attempt ${attempt + 1})`);
        await sleep(delay);
        delay *= DATAJUD_RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      // Parse successful response
      if (!response.ok) {
        throw new DataJudTypedError(
          `API returned status ${response.status}`,
          'SERVER_ERROR',
          response.status
        );
      }

      const responseData = await response.json().catch(() => ({}));
      const result = parseApiResponse(responseData, query, durationMs);

      // Apply privacy filter to all processes
      result.processes = result.processes.map(applyPrivacyFilter);

      // Cache the result
      cacheResult(query, result);

      console.log(`[DataJud] Search completed: ${result.processes.length} results (${durationMs}ms)`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry validation/auth errors
      const typedError = lastError as DataJudTypedError;
      if (typedError && 'code' in typedError && typedError.code === 'AUTH') {
        throw lastError;
      }

      // Retry on network errors
      if (attempt < DATAJUD_RETRY_CONFIG.maxRetries) {
        console.warn(`[DataJud] Search error (attempt ${attempt + 1}): ${redactLog(lastError.message)}`);
        await sleep(delay);
        delay *= DATAJUD_RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      // Max retries exceeded
      throw new DataJudTypedError(
        `Search failed after ${DATAJUD_RETRY_CONFIG.maxRetries + 1} attempts: ${lastError.message}`,
        'NETWORK',
        undefined,
        { originalError: lastError.message }
      );
    }
  }

  // This should never be reached, but just in case
  throw lastError || new DataJudTypedError('Unknown search error', 'NETWORK');
}

// =============================================================================
// Convenience Search Methods
// =============================================================================

/**
 * Search by process number
 */
export async function searchByNumber(
  court: string,
  processNumber: string,
  options?: { size?: number }
): Promise<DataJudSearchResult> {
  const validation = validateProcessNumber(processNumber);
  if (!validation.valid) {
    throw new DataJudTypedError(
      validation.error || 'Invalid process number format',
      'INVALID_QUERY'
    );
  }

  return search({
    court,
    queryType: 'number',
    value: validation.cleaned!,
    size: options?.size || 10,
  });
}

/**
 * Search by procedural class (TPU code)
 */
export async function searchByClass(
  court: string,
  classCode: string,
  options?: {
    size?: number;
    dateFrom?: string;
    dateTo?: string;
    instance?: string;
  }
): Promise<DataJudSearchResult> {
  return search({
    court,
    queryType: 'class',
    value: classCode,
    size: options?.size || 50,
    filters: {
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      instance: options?.instance as 'G1' | 'G2' | 'JE' | undefined,
    },
  });
}

/**
 * Search by party name
 */
export async function searchByParty(
  court: string,
  partyName: string,
  options?: { size?: number }
): Promise<DataJudSearchResult> {
  return search({
    court,
    queryType: 'party',
    value: partyName,
    size: options?.size || 10,
  });
}

/**
 * Search by date range
 */
export async function searchByDateRange(
  court: string,
  dateFrom: string,
  dateTo: string,
  options?: {
    size?: number;
    instance?: string;
  }
): Promise<DataJudSearchResult> {
  return search({
    court,
    queryType: 'date_range',
    value: '',
    size: options?.size || 100,
    filters: {
      dateFrom,
      dateTo,
      instance: options?.instance as 'G1' | 'G2' | 'JE' | undefined,
    },
  });
}

// =============================================================================
// Court Information Methods
// =============================================================================

/**
 * Get list of all supported courts
 */
export function getCourts(): DataJudCourt[] {
  return DATAJUD_COURTS;
}

/**
 * Get court by alias
 */
export function getCourtByAlias(alias: string): DataJudCourt | undefined {
  return DATAJUD_COURTS.find((court) => court.alias === alias);
}

/**
 * Get courts by category
 */
export function getCourtsByCategory(category: string): DataJudCourt[] {
  return DATAJUD_COURTS.filter((court) => court.category === category);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for DataJudError
 */
export function isDataJudError(error: unknown): error is DataJudError {
  return (
    error instanceof Error &&
    error.name === 'DataJudError' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}
