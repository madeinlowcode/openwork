/**
 * DataJud API TypeScript Types
 *
 * @description Type definitions for DataJud API integration with CNJ (National Council of Justice)
 * @see https://api-publica.datajud.cnj.jus.br/
 *
 * @dependencies None - base types for DataJud service
 *
 * @usedBy
 * - apps/desktop/src/main/services/datajud.ts
 * - apps/desktop/src/main/mcp/datajud-server.ts
 * - apps/desktop/src/main/store/repositories/datajudSearches.ts
 * - packages/shared/src/types/index.ts
 */

import type { Task } from './task';

/**
 * Court categories for hierarchical organization
 */
export type DataJudCourtCategory =
  | 'superior'     // STJs (STJ, TST, TSE, STM)
  | 'federal'      // TRF1-6
  | 'state'        // TJ + state code
  | 'labor'        // TRT1-24
  | 'electoral'    // TRE + state code
  | 'military';    // TJM + state code

/**
 * Query types supported by DataJud API
 */
export type DataJudQueryType =
  | 'number'       // Search by CNJ process number
  | 'class'        // Search by procedural class code (TPU)
  | 'party'        // Search by party name (author, defendant, lawyer)
  | 'date_range';  // Search by filing date range

/**
 * Instance levels in Brazilian judiciary
 */
export type DataJudInstance = 'G1' | 'G2' | 'JE';

/**
 * Process confidentiality levels
 * nivelSigilo > 0 indicates restricted access processes
 */
export type DataJudSigiloLevel = 0 | 1 | 2 | 3;

/**
 * Court information structure
 */
export interface DataJudCourt {
  /** Court alias for API endpoint (e.g., 'api_publica_stj', 'tjsp') */
  alias: string;
  /** Full court name in Portuguese */
  name: string;
  /** Court category for UI organization */
  category: DataJudCourtCategory;
  /** State code for state-level courts (e.g., 'SP', 'RJ') */
  state?: string;
  /** Whether court is currently available */
  isActive: boolean;
}

/**
 * Procedural class (TPU - Tabela de Procedimentos Unificada)
 */
export interface DataJudProceduralClass {
  /** TPU code */
  codigo: string;
  /** Class name */
  nome: string;
}

/**
 * Judging body (orgao julgador)
 */
export interface DataJudOrgaoJulgador {
  /** Body code */
  codigo: string;
  /** Body name */
  nome: string;
}

/**
 * Party involved in the process
 */
export interface DataJudParty {
  /** Party type: autor (plaintiff), reu (defendant), advogado (lawyer), etc. */
  tipo: string;
  /** Party name */
  nome: string;
  /** CPF or CNPJ (may be masked for privacy) */
  documento?: string;
  /** Whether this is the lead party */
  isLead: boolean;
}

/**
 * Movement in the process timeline
 */
export interface DataJudMovement {
  /** Movement date ISO */
  dataMovimentacao: string;
  /** Movement type code */
  codigoTipoMovimento: number;
  /** Movement type name */
  tipoMovimento: string;
  /** Movement description */
  descricaoMovimento: string;
}

/**
 * Main process data from DataJud response
 */
export interface DataJudProcess {
  /** CNJ process number (format: 0000000-00.0000.0.00.0000) */
  numeroProcesso: string;
  /** Procedural class */
  classe: DataJudProceduralClass;
  /** Tribunal code (e.g., 'TJSP', 'TRF1') */
  tribunal: string;
  /** Instance level */
  grau: DataJudInstance;
  /** Filing date ISO */
  dataAjuizamento: string;
  /** Judge body */
  orgaoJulgador?: DataJudOrgaoJulgador;
  /** Subjects/temas */
  temas?: Array<{ codigo: string; nome: string }>;
  /** Parties involved */
  partes?: DataJudParty[];
  /** Case movements */
  movimentacoes?: DataJudMovement[];
  /** Confidentiality level - processes with > 0 have restricted data */
  nivelSigilo: DataJudSigiloLevel;
  /** Last update date */
  dataUltimaAtualizacao?: string;
}

/**
 * Search filters for advanced queries
 */
export interface DataJudSearchFilters {
  /** Start date for date range queries (ISO format) */
  dateFrom?: string;
  /** End date for date range queries (ISO format) */
  dateTo?: string;
  /** Instance level filter */
  instance?: DataJudInstance;
  /** Specific court to search within (for cross-court queries) */
  courtFilter?: string;
}

/**
 * Search query parameters
 */
export interface DataJudQuery {
  /** Court alias to search */
  court: string;
  /** Type of search */
  queryType: DataJudQueryType;
  /** Search value (process number, class code, party name, etc.) */
  value: string;
  /** Maximum number of results (default: 10, max: 10000) */
  size?: number;
  /** Pagination cursor for deep pagination */
  searchAfter?: string[];
  /** Additional filters */
  filters?: DataJudSearchFilters;
}

/**
 * Pagination info from search response
 */
export interface DataJudPagination {
  /** Total number of matching records */
  total: number;
  /** Current page size */
  size: number;
  /** Cursor for next page (for search_after pagination) */
  nextCursor?: string[];
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Search result container
 */
export interface DataJudSearchResult {
  /** Matching processes */
  processes: DataJudProcess[];
  /** Pagination info */
  pagination: DataJudPagination;
  /** Search metadata */
  metadata: {
    /** Query that produced these results */
    query: DataJudQuery;
    /** Timestamp of the search */
    searchedAt: string;
    /** Time taken in milliseconds */
    durationMs: number;
  };
}

/**
 * Error codes for DataJud API
 */
export type DataJudErrorCode =
  | 'NETWORK'         // Network connectivity issues
  | 'AUTH'            // Invalid or missing API key
  | 'RATE_LIMIT'      // Rate limit exceeded
  | 'INVALID_QUERY'   // Malformed query or invalid parameters
  | 'NO_RESULTS'      // Valid query but no matching processes
  | 'TIMEOUT'         // Request timeout
  | 'SIGILO'          // Process has confidentiality restrictions
  | 'SERVER_ERROR';   // DataJud server error (5xx)

/**
 * Typed error for DataJud operations
 */
export class DataJudError extends Error {
  constructor(
    message: string,
    public code: DataJudErrorCode,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'DataJudError';
  }

  /**
   * Check if error is retryable based on status code
   */
  isRetryable(): boolean {
    return [408, 429, 500, 502, 503, 504].includes(this.statusCode || 0);
  }
}

/**
 * Record type for SQLite search history table
 */
export interface DataJudSearchHistoryRecord {
  /** Primary key */
  id: number;
  /** Court alias searched */
  court: string;
  /** Type of query performed */
  queryType: DataJudQueryType;
  /** Search value */
  queryValue: string;
  /** Number of results returned */
  resultCount: number;
  /** JSON string of full response (for cache) */
  responseData: string | null;
  /** When the search was performed */
  createdAt: number;
  /** Associated task ID (foreign key to tasks table) */
  taskId: string | null;
}

/**
 * API configuration for DataJud
 */
export interface DataJudConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for API requests */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retries on failure */
  maxRetries: number;
  /** Rate limit: requests per minute */
  rateLimitPerMinute: number;
  /** Cache TTL for number searches (milliseconds) */
  numberSearchCacheTtlMs: number;
  /** Cache TTL for generic searches (milliseconds) */
  genericSearchCacheTtlMs: number;
}

/**
 * Status of DataJud API key validation
 */
export type DataJudKeyStatus =
  | 'unset'      // No API key configured
  | 'validating' // Currently validating
  | 'valid'      // Key is valid
  | 'invalid'    // Key is invalid
  | 'error';     // Validation error occurred

/**
 * State for API key management UI
 */
export interface DataJudKeyState {
  /** Current key status */
  status: DataJudKeyStatus;
  /** Error message if status is 'invalid' or 'error' */
  errorMessage?: string;
  /** Last validation timestamp */
  lastValidatedAt?: number;
}

/**
 * Court selection for query form UI
 */
export interface DataJudCourtSelection {
  /** Selected court alias */
  courtAlias: string;
  /** Selected court info */
  court: DataJudCourt;
  /** Whether this is a cross-court search */
  isCrossCourt: boolean;
}

/**
 * MCP tool input schema for datajud_search
 */
export interface DataJudMCPToolInput {
  /** Court alias (e.g., 'api_publica_stj', 'tjsp') */
  court: string;
  /** Query type: 'number' | 'class' | 'party' | 'date_range' */
  query_type: DataJudQueryType;
  /** Search value (process number, class code, party name) */
  value: string;
  /** Maximum results to return (default: 10) */
  size?: number;
  /** Optional filters */
  filters?: DataJudSearchFilters;
}

/**
 * Formatted output for chat display
 */
export interface DataJudFormattedResult {
  /** Process number formatted with formatting */
  formattedNumber: string;
  /** Class name */
  className: string;
  /** Tribunal */
  court: string;
  /** Instance */
  instance: string;
  /** Filing date */
  filingDate: string;
  /** Parties summary (first 3) */
  partiesSummary: string[];
  /** Last movement */
  lastMovement?: {
    date: string;
    description: string;
  };
  /** Whether process has sigilo */
  hasSigilo: boolean;
  /** Sigilo warning message if applicable */
  sigiloWarning?: string;
}

/**
 * Task that triggered a DataJud search (for history linking)
 */
export interface DataJudAssociatedTask {
  taskId: string;
  taskSummary?: string;
  taskPrompt: string;
}
