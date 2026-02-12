#!/usr/bin/env node
/**
 * @skill datajud-server
 * @description MCP Server para consulta direta de processos judiciais via API DataJud do CNJ
 *
 * Este servidor faz chamadas HTTP diretas a API DataJud do CNJ para buscar
 * informacoes de processos judiciais em todos os tribunais brasileiros.
 *
 * @dependencies
 * - @modelcontextprotocol/sdk (Server, StdioServerTransport)
 * - zod (validacao de schemas)
 *
 * @environment
 * - DATAJUD_API_KEY: Chave da API DataJud (requerida)
 *
 * @relatedFiles
 * - apps/desktop/skills/consulta-processos (skill de navegacao web)
 */

console.error('[datajud-server] Script starting...');
console.error('[datajud-server] Node version:', process.version);
console.error('[datajud-server] DATAJUD_API_KEY set:', process.env.DATAJUD_API_KEY ? 'yes (length: ' + process.env.DATAJUD_API_KEY.length + ')' : 'NO');

// ============================================================================
// Imports
// ============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

console.error('[datajud-server] All imports completed successfully');

// ============================================================================
// Configuration
// ============================================================================

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';

const TIMEOUTS = {
  search: 30000,
  largeSearch: 60000,
} as const;

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504] as const,
} as const;

const RATE_LIMIT = {
  requestsPerMinute: 60,
  minIntervalMs: 1000,
} as const;

const CACHE_TTL = {
  numberSearch: 5 * 60 * 1000, // 5 minutes
  genericSearch: 1 * 60 * 1000, // 1 minute
} as const;

// ============================================================================
// Types
// ============================================================================

interface CourtInfo {
  alias: string;
  name: string;
  category: 'superior' | 'federal' | 'state' | 'labor' | 'electoral' | 'military';
  state?: string;
}

interface ProcessInfo {
  numeroProcesso: string;
  classe: {
    codigo: string;
    nome: string;
  };
  tribunal: string;
  grau: 'G1' | 'G2' | 'JE';
  dataAjuizamento: string;
  nivelSigilo: number;
  dataUltimaAtualizacao?: string;
}

interface SearchResult {
  processes: ProcessInfo[];
  pagination: {
    total: number;
    size: number;
    hasMore: boolean;
  };
}

interface ErrorResponse {
  erro: string;
  codigo?: string;
  detalhes?: unknown;
}

// ============================================================================
// Court Registry
// ============================================================================

const COURTS: Record<string, CourtInfo> = {
  // Superior Courts
  api_publica_stj: { alias: 'api_publica_stj', name: 'Superior Tribunal de Justica', category: 'superior' },
  api_publica_tst: { alias: 'api_publica_tst', name: 'Tribunal Superior do Trabalho', category: 'superior' },
  api_publica_tse: { alias: 'api_publica_tse', name: 'Tribunal Superior Eleitoral', category: 'superior' },
  api_publica_stm: { alias: 'api_publica_stm', name: 'Tribunal Superior Militar', category: 'superior' },

  // Regional Federal Courts
  api_publica_trf1: { alias: 'api_publica_trf1', name: 'Tribunal Regional Federal da 1a Regiao', category: 'federal', state: 'DF' },
  api_publica_trf2: { alias: 'api_publica_trf2', name: 'Tribunal Regional Federal da 2a Regiao', category: 'federal', state: 'RJ' },
  api_publica_trf3: { alias: 'api_publica_trf3', name: 'Tribunal Regional Federal da 3a Regiao', category: 'federal', state: 'SP' },
  api_publica_trf4: { alias: 'api_publica_trf4', name: 'Tribunal Regional Federal da 4a Regiao', category: 'federal', state: 'RS' },
  api_publica_trf5: { alias: 'api_publica_trf5', name: 'Tribunal Regional Federal da 5a Regiao', category: 'federal', state: 'PE' },
  api_publica_trf6: { alias: 'api_publica_trf6', name: 'Tribunal Regional Federal da 6a Regiao', category: 'federal', state: 'PR' },

  // State Courts
  tjsp: { alias: 'tjsp', name: 'Tribunal de Justica de Sao Paulo', category: 'state', state: 'SP' },
  tjrj: { alias: 'tjrj', name: 'Tribunal de Justica do Rio de Janeiro', category: 'state', state: 'RJ' },
  tjmg: { alias: 'tjmg', name: 'Tribunal de Justica de Minas Gerais', category: 'state', state: 'MG' },
  tjba: { alias: 'tjba', name: 'Tribunal de Justica da Bahia', category: 'state', state: 'BA' },
  tjrs: { alias: 'tjrs', name: 'Tribunal de Justica do Rio Grande do Sul', category: 'state', state: 'RS' },
  tjpr: { alias: 'tjpr', name: 'Tribunal de Justica do Parana', category: 'state', state: 'PR' },
  tjsc: { alias: 'tjsc', name: 'Tribunal de Justica de Santa Catarina', category: 'state', state: 'SC' },
  tjce: { alias: 'tjce', name: 'Tribunal de Justica do Ceara', category: 'state', state: 'CE' },
  tjpe: { alias: 'tjpe', name: 'Tribunal de Justica de Pernambuco', category: 'state', state: 'PE' },
  tjgo: { alias: 'tjgo', name: 'Tribunal de Justica de Goias', category: 'state', state: 'GO' },
};

// ============================================================================
// Cache & Rate Limiting
// ============================================================================

const searchCache = new Map<string, { data: SearchResult; timestamp: number }>();
const requestHistory: number[] = [];
let lastRequestTime = 0;

function getCachedResult(query: Record<string, unknown>): SearchResult | null {
  const key = JSON.stringify(query);
  const entry = searchCache.get(key);

  if (!entry) return null;

  const ttl = key.includes('numeroProcesso')
    ? CACHE_TTL.numberSearch
    : CACHE_TTL.genericSearch;

  if (Date.now() - entry.timestamp > ttl) {
    searchCache.delete(key);
    return null;
  }

  return entry.data;
}

function cacheResult(query: Record<string, unknown>, result: SearchResult): void {
  const key = JSON.stringify(query);
  searchCache.set(key, { data: result, timestamp: Date.now() });
}

function checkRateLimit(): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;

  while (requestHistory.length > 0 && requestHistory[0] < now - windowMs) {
    requestHistory.shift();
  }

  if (requestHistory.length >= RATE_LIMIT.requestsPerMinute) {
    const waitMs = (requestHistory[0] + windowMs) - now;
    return { allowed: false, waitMs: Math.max(waitMs, RATE_LIMIT.minIntervalMs) };
  }

  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < RATE_LIMIT.minIntervalMs) {
    return { allowed: false, waitMs: RATE_LIMIT.minIntervalMs - timeSinceLast };
  }

  return { allowed: true, waitMs: 0 };
}

function recordRequest(): void {
  const now = Date.now();
  requestHistory.push(now);
  lastRequestTime = now;
}

// ============================================================================
// API Functions
// ============================================================================

async function waitForRateLimit(): Promise<void> {
  const { allowed, waitMs } = checkRateLimit();
  if (!allowed && waitMs > 0) {
    console.error(`[datajud-server] Rate limit active, waiting ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactApiKey(text: string): string {
  return text.replace(/APIKey\s*[a-zA-Z0-9\-_]+/gi, 'APIKey [REDACTED]');
}

function buildSearchQuery(
  queryType: string,
  value: string,
  size: number,
  filters?: Record<string, unknown>
): Record<string, unknown> {
  const baseQuery: Record<string, unknown> = {
    size: Math.min(size, 10000),
  };

  switch (queryType) {
    case 'number': {
      const cleanNumber = value.replace(/\D/g, '');
      baseQuery.query = { match: { numeroProcesso: cleanNumber } };
      break;
    }

    case 'class': {
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

      baseQuery.query = { bool: { must, filter } };
      break;
    }

    case 'party': {
      baseQuery.query = { match: { 'partes.nome': value } };
      break;
    }

    case 'date_range': {
      const must: Record<string, unknown>[] = [{ match_all: {} }];
      const filter: Record<string, unknown>[] = [];

      if (filters?.dateFrom || filters?.dateTo) {
        const range: Record<string, unknown> = {};
        if (filters.dateFrom) range.gte = filters.dateFrom;
        if (filters.dateTo) range.lte = filters.dateTo;
        filter.push({ range: { dataAjuizamento: range } });
      }

      baseQuery.query = { bool: { must, filter } };
      break;
    }
  }

  baseQuery.sort = ['_id'];

  return baseQuery;
}

function parseApiResponse(response: Record<string, unknown>, size: number): SearchResult {
  const hits = response.hits as Record<string, unknown> | undefined;
  const total = hits?.total as Record<string, unknown> | undefined;
  const hitsArray = (hits?.hits as Array<Record<string, unknown>> | undefined) || [];

  const processes: ProcessInfo[] = hitsArray.map((hit) => {
    const source = hit._source as Record<string, unknown> | undefined;
    return {
      numeroProcesso: (source?.numeroProcesso as string) || '',
      classe: {
        codigo: ((source?.classe as Record<string, unknown>)?.codigo as string) || '',
        nome: ((source?.classe as Record<string, unknown>)?.nome as string) || '',
      },
      tribunal: (source?.tribunal as string) || '',
      grau: ((source?.grau as string) || 'G1') as 'G1' | 'G2' | 'JE',
      dataAjuizamento: (source?.dataAjuizamento as string) || '',
      nivelSigilo: (source?.nivelSigilo as number) || 0,
      dataUltimaAtualizacao: (source?.dataUltimaAtualizacao as string) || undefined,
    };
  });

  const totalValue = (total?.value as number) || 0;

  return {
    processes,
    pagination: {
      total: totalValue,
      size: processes.length,
      hasMore: processes.length < totalValue,
    },
  };
}

function applyPrivacyFilter(process: ProcessInfo): ProcessInfo {
  if (process.nivelSigilo === 0) {
    return process;
  }

  // Process has sigilo - this is a public MCP, return limited info
  return {
    ...process,
    nivelSigilo: process.nivelSigilo,
  };
}

async function executeSearch(
  court: string,
  queryType: string,
  value: string,
  size: number,
  filters?: Record<string, unknown>
): Promise<SearchResult> {
  const apiKey = process.env.DATAJUD_API_KEY;

  if (!apiKey) {
    throw new Error('DATAJUD_API_KEY environment variable is not set');
  }

  // Check cache first
  const cacheKey = { court, queryType, value, size, filters };
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.error('[datajud-server] Cache hit for query');
    return cached;
  }

  // Check rate limit
  await waitForRateLimit();
  recordRequest();

  const url = `${DATAJUD_BASE_URL}/${court}/_search`;
  const queryBody = buildSearchQuery(queryType, value, size, filters);
  const timeout = size > 1000 ? TIMEOUTS.largeSearch : TIMEOUTS.search;

  console.error('[datajud-server] Executing search:', redactApiKey(JSON.stringify({ url, queryType, size })));

  let lastError: Error | null = null;
  let delay = RETRY_CONFIG.initialDelay;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      }, timeout);

      if (response.status === 429) {
        console.error(`[datajud-server] Rate limited (attempt ${attempt + 1}), waiting ${delay}ms`);
        await sleep(delay);
        delay *= RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      const statusCode = response.status as number;
      if (RETRY_CONFIG.retryableStatusCodes.includes(statusCode as 408 | 429 | 500 | 502 | 503 | 504)) {
        console.error(`[datajud-server] Retryable error ${response.status} (attempt ${attempt + 1})`);
        await sleep(delay);
        delay *= RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or unauthorized DataJud API key');
      }

      if (response.status === 400) {
        throw new Error(`Invalid query: ${await response.text()}`);
      }

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const responseData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const result = parseApiResponse(responseData, size);

      // Apply privacy filter
      result.processes = result.processes.map(applyPrivacyFilter);

      // Cache result
      cacheResult(cacheKey, result);

      console.error(`[datajud-server] Search completed: ${result.processes.length} results`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('Invalid') || lastError.message.includes('Unauthorized')) {
        throw lastError;
      }

      if (attempt < RETRY_CONFIG.maxRetries) {
        console.error(`[datajud-server] Search error (attempt ${attempt + 1}): ${lastError.message}`);
        await sleep(delay);
        delay *= RETRY_CONFIG.backoffMultiplier;
        continue;
      }

      throw new Error(`Search failed after ${RETRY_CONFIG.maxRetries + 1} attempts: ${lastError.message}`);
    }
  }

  throw lastError || new Error('Unknown search error');
}

// ============================================================================
// Zod Schemas
// ============================================================================

const CourtEnum = z.enum(Object.keys(COURTS) as [string, ...string[]]);

const SearchByNumberSchema = z.object({
  court: CourtEnum.describe('Court alias (e.g., tjsp, api_publica_stj)'),
  processNumber: z.string().describe('Process number (NPU format or just digits)'),
  size: z.number().min(1).max(10000).optional().default(10),
});

const SearchByClassSchema = z.object({
  court: CourtEnum.describe('Court alias'),
  classCode: z.string().describe('Procedural class code (TPU code)'),
  size: z.number().min(1).max(10000).optional().default(50),
  dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
  instance: z.enum(['G1', 'G2', 'JE']).optional().describe('Instance level'),
});

const SearchByPartySchema = z.object({
  court: CourtEnum.describe('Court alias'),
  partyName: z.string().describe('Name of the party (plaintiff, defendant, lawyer)'),
  size: z.number().min(1).max(10000).optional().default(10),
});

const SearchByDateRangeSchema = z.object({
  court: CourtEnum.describe('Court alias'),
  dateFrom: z.string().describe('Start date (YYYY-MM-DD)'),
  dateTo: z.string().describe('End date (YYYY-MM-DD)'),
  size: z.number().min(1).max(10000).optional().default(100),
  instance: z.enum(['G1', 'G2', 'JE']).optional().describe('Instance level'),
});

const ListCourtsSchema = z.object({
  category: z.enum(['superior', 'federal', 'state', 'labor', 'electoral', 'military', 'all']).optional().default('all').describe('Filter by court category'),
});

// ============================================================================
// Response Formatters
// ============================================================================

function formatProcessForDisplay(process: ProcessInfo): object {
  const sigiloLevel = process.nivelSigilo;

  return {
    numeroProcesso: process.numeroProcesso,
    classe: process.classe.nome,
    tribunal: process.tribunal,
    grau: process.grau,
    dataAjuizamento: process.dataAjuizamento,
    nivelSigilo: sigiloLevel,
    nivelSigiloDescricao: sigiloLevel === 0 ? 'Publico' : sigiloLevel === 1 ? 'Sigilo Judicial' : sigiloLevel === 2 ? 'Sigilo Investigativo' : 'Sigilo de Estado',
    dataUltimaAtualizacao: process.dataUltimaAtualizacao,
    aviso: sigiloLevel > 0 ? 'Processo com restricao de acesso - dados limitados' : undefined,
  };
}

function formatSearchResult(result: SearchResult, queryType: string): object {
  return {
    tipo: 'resultado_pesquisa_datajud',
    queryType,
    totalResultados: result.pagination.total,
    retornados: result.processes.length,
    haMais: result.pagination.hasMore,
    processos: result.processes.map(formatProcessForDisplay),
  };
}

function formatError(error: Error, code?: string): object {
  return {
    erro: error.message,
    codigo: code || 'UNKNOWN',
    sugestao: 'Verifique a chave da API e os parametros da consulta',
  };
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  {
    name: 'datajud-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'datajud_search_by_number',
        description:
          'Search for a specific process by its CNJ process number (NPU). ' +
          'Returns detailed information about the process including class, court, filing date, and current status.',
        inputSchema: {
          type: 'object',
          properties: {
            court: {
              type: 'string',
              description: 'Court alias (e.g., tjsp, tjrj, api_publica_stj)',
              enum: Object.keys(COURTS),
            },
            processNumber: {
              type: 'string',
              description: 'Process number in NPU format (0000000-00.0000.0.00.0000) or just digits',
            },
            size: {
              type: 'number',
              description: 'Maximum number of results (default: 10, max: 10000)',
              minimum: 1,
              maximum: 10000,
            },
          },
          required: ['court', 'processNumber'],
        },
      },
      {
        name: 'datajud_search_by_class',
        description:
          'Search for processes by procedural class code (TPU - Tabela de Procedimentos Unificada). ' +
          'Useful for finding all processes of a specific type.',
        inputSchema: {
          type: 'object',
          properties: {
            court: {
              type: 'string',
              description: 'Court alias',
              enum: Object.keys(COURTS),
            },
            classCode: {
              type: 'string',
              description: 'Procedural class code (e.g., Monitorio, Procedimento Comum Civel)',
            },
            size: {
              type: 'number',
              description: 'Maximum results (default: 50)',
              minimum: 1,
              maximum: 10000,
            },
            dateFrom: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD)',
            },
            dateTo: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD)',
            },
            instance: {
              type: 'string',
              description: 'Instance level: G1 (1st), G2 (2nd), JE (Special)',
              enum: ['G1', 'G2', 'JE'],
            },
          },
          required: ['court', 'classCode'],
        },
      },
      {
        name: 'datajud_search_by_party',
        description:
          'Search for processes by party name (plaintiff, defendant, lawyer). ' +
          'Returns all processes where the party is involved.',
        inputSchema: {
          type: 'object',
          properties: {
            court: {
              type: 'string',
              description: 'Court alias',
              enum: Object.keys(COURTS),
            },
            partyName: {
              type: 'string',
              description: 'Name of the party to search for',
            },
            size: {
              type: 'number',
              description: 'Maximum results (default: 10)',
              minimum: 1,
              maximum: 10000,
            },
          },
          required: ['court', 'partyName'],
        },
      },
      {
        name: 'datajud_search_by_date_range',
        description:
          'Search for processes filed within a date range. ' +
          'Useful for finding recent filings or analyzing case volume.',
        inputSchema: {
          type: 'object',
          properties: {
            court: {
              type: 'string',
              description: 'Court alias',
              enum: Object.keys(COURTS),
            },
            dateFrom: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            dateTo: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
            size: {
              type: 'number',
              description: 'Maximum results (default: 100)',
              minimum: 1,
              maximum: 10000,
            },
            instance: {
              type: 'string',
              description: 'Instance level: G1, G2, or JE',
              enum: ['G1', 'G2', 'JE'],
            },
          },
          required: ['court', 'dateFrom', 'dateTo'],
        },
      },
      {
        name: 'datajud_list_courts',
        description:
          'List all available courts for DataJud API queries. ' +
          'Returns court information including aliases, names, and categories.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category: superior, federal, state, labor, all (default)',
              enum: ['superior', 'federal', 'state', 'labor', 'electoral', 'military', 'all'],
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[datajud-server] Executing tool: ${name}`);
  console.error(`[datajud-server] Arguments:`, redactApiKey(JSON.stringify(args)));

  try {
    switch (name) {
      case 'datajud_search_by_number': {
        const params = SearchByNumberSchema.parse(args);
        const result = await executeSearch(
          params.court,
          'number',
          params.processNumber,
          params.size
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatSearchResult(result, 'numero'), null, 2),
            },
          ],
        };
      }

      case 'datajud_search_by_class': {
        const params = SearchByClassSchema.parse(args);
        const filters: Record<string, unknown> = {};
        if (params.dateFrom) filters.dateFrom = params.dateFrom;
        if (params.dateTo) filters.dateTo = params.dateTo;
        if (params.instance) filters.instance = params.instance;

        const result = await executeSearch(
          params.court,
          'class',
          params.classCode,
          params.size,
          filters
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatSearchResult(result, 'classe'), null, 2),
            },
          ],
        };
      }

      case 'datajud_search_by_party': {
        const params = SearchByPartySchema.parse(args);
        const result = await executeSearch(
          params.court,
          'party',
          params.partyName,
          params.size
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatSearchResult(result, 'parte'), null, 2),
            },
          ],
        };
      }

      case 'datajud_search_by_date_range': {
        const params = SearchByDateRangeSchema.parse(args);
        const filters: Record<string, unknown> = {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        };
        if (params.instance) filters.instance = params.instance;

        const result = await executeSearch(
          params.court,
          'date_range',
          '',
          params.size,
          filters
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatSearchResult(result, 'data_range'), null, 2),
            },
          ],
        };
      }

      case 'datajud_list_courts': {
        const params = ListCourtsSchema.parse(args);

        let courts = Object.values(COURTS);
        if (params.category && params.category !== 'all') {
          courts = courts.filter((c) => c.category === params.category);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tipo: 'lista_tribunais',
                filtro: params.category,
                total: courts.length,
                tribunais: courts,
              }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                erro: `Unknown tool: ${name}`,
                ferramentas_disponiveis: [
                  'datajud_search_by_number',
                  'datajud_search_by_class',
                  'datajud_search_by_party',
                  'datajud_search_by_date_range',
                  'datajud_list_courts',
                ],
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[datajud-server] Error:`, error);

    const errorObj = error instanceof Error ? error : new Error(String(error));
    let code: string | undefined;

    if (errorObj.message.includes('API key') || errorObj.message.includes('Unauthorized')) {
      code = 'AUTH';
    } else if (errorObj.message.includes('rate limit') || errorObj.message.includes('429')) {
      code = 'RATE_LIMIT';
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formatError(errorObj, code)),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.error('[datajud-server] Starting MCP server v1.0 (API direct)...');

  // Check for API key
  if (!process.env.DATAJUD_API_KEY) {
    console.error('[datajud-server] WARNING: DATAJUD_API_KEY environment variable is not set');
    console.error('[datajud-server] Set DATAJUD_API_KEY environment variable before using this server');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[datajud-server] MCP server connected and ready');
  console.error('[datajud-server] Tools available:');
  console.error('[datajud-server]   - datajud_search_by_number');
  console.error('[datajud-server]   - datajud_search_by_class');
  console.error('[datajud-server]   - datajud_search_by_party');
  console.error('[datajud-server]   - datajud_search_by_date_range');
  console.error('[datajud-server]   - datajud_list_courts');
}

main().catch((error) => {
  console.error('[datajud-server] Fatal error:', error);
  process.exit(1);
});
