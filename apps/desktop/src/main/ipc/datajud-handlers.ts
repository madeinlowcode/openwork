// apps/desktop/src/main/ipc/datajud-handlers.ts

/**
 * DataJud IPC Handlers
 *
 * @description IPC handlers for DataJud API operations
 *
 * @context Main process handlers for DataJud settings and search history
 *
 * @dependencies
 * - apps/desktop/src/main/services/datajud.ts
 * - apps/desktop/src/main/store/repositories/datajudSearches.ts
 * - apps/desktop/src/main/store/secureStorage.ts
 *
 * @usedBy
 * - apps/desktop/src/main/ipc/handlers.ts (registered handlers)
 * - apps/desktop/src/preload/index.ts (exposed to renderer)
 *
 * 🔒 AIDEV-SECURITY: API keys are never exposed via IPC
 * ⚠️ AIDEV-WARNING: All handlers validate input parameters
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import {
  isDataJudConfigured,
  validateApiKey,
  setDataJudApiKeyStored,
  getDataJudApiKeyStored,
  deleteDataJudApiKeyStored,
  getCourts,
  getCourtByAlias,
  getCourtsByCategory,
  search,
  searchByNumber,
  searchByClass,
  searchByParty,
  searchByDateRange,
  clearSearchCache,
} from '../services/datajud';
import {
  saveSearch,
  getRecentSearches,
  deleteSearch,
  clearHistory,
  getSearchCountByCourt,
  getTotalSearchCount,
} from '../store/repositories/datajudSearches';
import type { DataJudQuery, DataJudSearchResult } from '@accomplish/shared';
import { redactDataJudKey } from '../utils/datajud-redact';

// =============================================================================
// IPC Handler Registration
// =============================================================================

/**
 * Register all DataJud IPC handlers
 */
export function registerDataJudHandlers(): void {
  console.log('[DataJudIPC] Registering handlers');

  // API Key Management
  ipcMain.handle('datajud:is-configured', handleIsConfigured);
  ipcMain.handle('datajud:set-api-key', handleSetApiKey);
  ipcMain.handle('datajud:get-api-key', handleGetApiKey);
  ipcMain.handle('datajud:delete-api-key', handleDeleteApiKey);
  ipcMain.handle('datajud:validate-key', handleValidateKey);

  // Court Information
  ipcMain.handle('datajud:get-courts', handleGetCourts);
  ipcMain.handle('datajud:get-court', handleGetCourt);
  ipcMain.handle('datajud:get-courts-by-category', handleGetCourtsByCategory);

  // Search Operations
  ipcMain.handle('datajud:search', handleSearch);
  ipcMain.handle('datajud:search-by-number', handleSearchByNumber);
  ipcMain.handle('datajud:search-by-class', handleSearchByClass);
  ipcMain.handle('datajud:search-by-party', handleSearchByParty);
  ipcMain.handle('datajud:search-by-date-range', handleSearchByDateRange);

  // History Management
  ipcMain.handle('datajud:get-history', handleGetHistory);
  ipcMain.handle('datajud:delete-history-item', handleDeleteHistoryItem);
  ipcMain.handle('datajud:clear-history', handleClearHistory);
  ipcMain.handle('datajud:get-history-stats', handleGetHistoryStats);

  // Cache Management
  ipcMain.handle('datajud:clear-cache', handleClearCache);
}

// =============================================================================
// API Key Handlers
// =============================================================================

/**
 * Check if DataJud API key is configured
 */
async function handleIsConfigured(): Promise<boolean> {
  try {
    const configured = isDataJudConfigured();
    console.log(`[DataJudIPC] is-configured: ${configured}`);
    return configured;
  } catch (error) {
    console.error('[DataJudIPC] Error checking configuration:', error);
    return false;
  }
}

/**
 * Set DataJud API key
 */
async function handleSetApiKey(
  _event: IpcMainInvokeEvent,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'API key is required' };
    }

    // Validate the API key before storing
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      console.warn('[DataJudIPC] API key validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    // Store the validated key
    setDataJudApiKeyStored(apiKey);
    console.log('[DataJudIPC] API key stored successfully');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Error setting API key:', redactDataJudKey(message));
    return { success: false, error: 'Failed to store API key' };
  }
}

/**
 * Get DataJud API key (masked)
 * AIDEV-SECURITY: Returns masked key for display purposes only
 */
async function handleGetApiKey(): Promise<{ hasKey: boolean; maskedKey?: string }> {
  try {
    const key = getDataJudApiKeyStored();

    if (!key) {
      return { hasKey: false };
    }

    // Return masked key (first 8 chars + asterisks + last 4 chars)
    const masked = key.length > 12
      ? `${key.substring(0, 8)}****${key.substring(key.length - 4)}`
      : '********';

    return { hasKey: true, maskedKey: masked };
  } catch (error) {
    console.error('[DataJudIPC] Error getting API key:', error);
    return { hasKey: false, maskedKey: undefined };
  }
}

/**
 * Delete DataJud API key
 */
async function handleDeleteApiKey(): Promise<{ success: boolean }> {
  try {
    deleteDataJudApiKeyStored();
    console.log('[DataJudIPC] API key deleted');
    return { success: true };
  } catch (error) {
    console.error('[DataJudIPC] Error deleting API key:', error);
    return { success: false };
  }
}

/**
 * Validate DataJud API key
 */
async function handleValidateKey(
  _event: IpcMainInvokeEvent,
  apiKey?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const result = await validateApiKey(apiKey);
    console.log(`[DataJudIPC] Key validation: ${result.valid}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Error validating key:', redactDataJudKey(message));
    return { valid: false, error: 'Validation failed' };
  }
}

// =============================================================================
// Court Information Handlers
// =============================================================================

/**
 * Get all available courts
 */
async function handleGetCourts(): Promise<Array<{
  alias: string;
  name: string;
  category: string;
  state?: string;
  isActive: boolean;
}>> {
  try {
    const courts = getCourts();
    console.log(`[DataJudIPC] Returning ${courts.length} courts`);
    return courts;
  } catch (error) {
    console.error('[DataJudIPC] Error getting courts:', error);
    return [];
  }
}

/**
 * Get court by alias
 */
async function handleGetCourt(
  _event: IpcMainInvokeEvent,
  alias: string
): Promise<{ alias: string; name: string; category: string; state?: string; isActive: boolean } | null> {
  try {
    const court = getCourtByAlias(alias);
    return court || null;
  } catch (error) {
    console.error('[DataJudIPC] Error getting court:', error);
    return null;
  }
}

/**
 * Get courts by category
 */
async function handleGetCourtsByCategory(
  _event: IpcMainInvokeEvent,
  category: string
): Promise<Array<{
  alias: string;
  name: string;
  category: string;
  state?: string;
  isActive: boolean;
}>> {
  try {
    const courts = getCourtsByCategory(category);
    return courts;
  } catch (error) {
    console.error('[DataJudIPC] Error getting courts by category:', error);
    return [];
  }
}

// =============================================================================
// Search Handlers
// =============================================================================

/**
 * Perform a general search
 */
async function handleSearch(
  _event: IpcMainInvokeEvent,
  query: DataJudQuery
): Promise<{ success: boolean; result?: DataJudSearchResult; error?: string }> {
  try {
    // Validate basic input
    if (!query.court) {
      return { success: false, error: 'Court is required' };
    }
    if (!query.queryType) {
      return { success: false, error: 'Query type is required' };
    }
    if (!query.value && query.queryType !== 'date_range') {
      return { success: false, error: 'Search value is required' };
    }

    const result = await search(query);
    console.log(`[DataJudIPC] Search completed: ${result.processes.length} results`);

    // Save to history
    try {
      saveSearch(query, result);
    } catch (historyError) {
      // Don't fail the search if history save fails
      console.warn('[DataJudIPC] Failed to save search to history:', historyError);
    }

    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Search error:', redactDataJudKey(message));
    return { success: false, error: message };
  }
}

/**
 * Search by process number
 */
async function handleSearchByNumber(
  _event: IpcMainInvokeEvent,
  court: string,
  processNumber: string,
  options?: { size?: number }
): Promise<{ success: boolean; result?: DataJudSearchResult; error?: string }> {
  try {
    if (!court) {
      return { success: false, error: 'Court is required' };
    }
    if (!processNumber) {
      return { success: false, error: 'Process number is required' };
    }

    const result = await searchByNumber(court, processNumber, options);
    console.log(`[DataJudIPC] Search by number completed: ${result.processes.length} results`);

    // Save to history
    const query: DataJudQuery = {
      court,
      queryType: 'number',
      value: processNumber,
      size: options?.size,
    };
    try {
      saveSearch(query, result);
    } catch (historyError) {
      console.warn('[DataJudIPC] Failed to save search to history:', historyError);
    }

    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Search by number error:', redactDataJudKey(message));
    return { success: false, error: message };
  }
}

/**
 * Search by procedural class
 */
async function handleSearchByClass(
  _event: IpcMainInvokeEvent,
  court: string,
  classCode: string,
  options?: {
    size?: number;
    dateFrom?: string;
    dateTo?: string;
    instance?: string;
  }
): Promise<{ success: boolean; result?: DataJudSearchResult; error?: string }> {
  try {
    if (!court) {
      return { success: false, error: 'Court is required' };
    }
    if (!classCode) {
      return { success: false, error: 'Class code is required' };
    }

    const result = await searchByClass(court, classCode, options);
    console.log(`[DataJudIPC] Search by class completed: ${result.processes.length} results`);

    // Save to history
    const query: DataJudQuery = {
      court,
      queryType: 'class',
      value: classCode,
      size: options?.size,
      filters: {
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
        instance: options?.instance as 'G1' | 'G2' | 'JE' | undefined,
      },
    };
    try {
      saveSearch(query, result);
    } catch (historyError) {
      console.warn('[DataJudIPC] Failed to save search to history:', historyError);
    }

    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Search by class error:', redactDataJudKey(message));
    return { success: false, error: message };
  }
}

/**
 * Search by party name
 */
async function handleSearchByParty(
  _event: IpcMainInvokeEvent,
  court: string,
  partyName: string,
  options?: { size?: number }
): Promise<{ success: boolean; result?: DataJudSearchResult; error?: string }> {
  try {
    if (!court) {
      return { success: false, error: 'Court is required' };
    }
    if (!partyName) {
      return { success: false, error: 'Party name is required' };
    }

    const result = await searchByParty(court, partyName, options);
    console.log(`[DataJudIPC] Search by party completed: ${result.processes.length} results`);

    // Save to history
    const query: DataJudQuery = {
      court,
      queryType: 'party',
      value: partyName,
      size: options?.size,
    };
    try {
      saveSearch(query, result);
    } catch (historyError) {
      console.warn('[DataJudIPC] Failed to save search to history:', historyError);
    }

    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Search by party error:', redactDataJudKey(message));
    return { success: false, error: message };
  }
}

/**
 * Search by date range
 */
async function handleSearchByDateRange(
  _event: IpcMainInvokeEvent,
  court: string,
  dateFrom: string,
  dateTo: string,
  options?: { size?: number; instance?: string }
): Promise<{ success: boolean; result?: DataJudSearchResult; error?: string }> {
  try {
    if (!court) {
      return { success: false, error: 'Court is required' };
    }
    if (!dateFrom || !dateTo) {
      return { success: false, error: 'Date range (from and to) is required' };
    }

    const result = await searchByDateRange(court, dateFrom, dateTo, options);
    console.log(`[DataJudIPC] Search by date range completed: ${result.processes.length} results`);

    // Save to history
    const query: DataJudQuery = {
      court,
      queryType: 'date_range',
      value: `${dateFrom} to ${dateTo}`,
      size: options?.size,
      filters: {
        dateFrom,
        dateTo,
        instance: options?.instance as 'G1' | 'G2' | 'JE' | undefined,
      },
    };
    try {
      saveSearch(query, result);
    } catch (historyError) {
      console.warn('[DataJudIPC] Failed to save search to history:', historyError);
    }

    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DataJudIPC] Search by date range error:', redactDataJudKey(message));
    return { success: false, error: message };
  }
}

// =============================================================================
// History Handlers
// =============================================================================

/**
 * Get recent search history
 */
async function handleGetHistory(
  _event: IpcMainInvokeEvent,
  limit?: number
): Promise<Array<{
  id: number;
  court: string;
  queryType: string;
  queryValue: string;
  resultCount: number;
  createdAt: number;
}>> {
  try {
    const history = getRecentSearches(limit);
    console.log(`[DataJudIPC] Returning ${history.length} history items`);

    // Return simplified history (no response_data)
    return history.map((item) => ({
      id: item.id,
      court: item.court,
      queryType: item.queryType,
      queryValue: item.queryValue,
      resultCount: item.resultCount,
      createdAt: item.createdAt,
    }));
  } catch (error) {
    console.error('[DataJudIPC] Error getting history:', error);
    return [];
  }
}

/**
 * Delete a history item
 */
async function handleDeleteHistoryItem(
  _event: IpcMainInvokeEvent,
  id: number
): Promise<{ success: boolean }> {
  try {
    const deleted = deleteSearch(id);
    console.log(`[DataJudIPC] Delete history item ${id}: ${deleted}`);
    return { success: deleted };
  } catch (error) {
    console.error('[DataJudIPC] Error deleting history item:', error);
    return { success: false };
  }
}

/**
 * Clear all search history
 */
async function handleClearHistory(): Promise<{ success: boolean }> {
  try {
    clearHistory();
    console.log('[DataJudIPC] History cleared');
    return { success: true };
  } catch (error) {
    console.error('[DataJudIPC] Error clearing history:', error);
    return { success: false };
  }
}

/**
 * Get history statistics
 */
async function handleGetHistoryStats(): Promise<{
  totalSearches: number;
  searchesByCourt: Array<{ court: string; count: number }>;
} | null> {
  try {
    const stats = {
      totalSearches: getTotalSearchCount(),
      searchesByCourt: getSearchCountByCourt(),
    };
    return stats;
  } catch (error) {
    console.error('[DataJudIPC] Error getting history stats:', error);
    return null;
  }
}

// =============================================================================
// Cache Handlers
// =============================================================================

/**
 * Clear search cache
 */
async function handleClearCache(): Promise<{ success: boolean }> {
  try {
    clearSearchCache();
    console.log('[DataJudIPC] Cache cleared');
    return { success: true };
  } catch (error) {
    console.error('[DataJudIPC] Error clearing cache:', error);
    return { success: false };
  }
}
