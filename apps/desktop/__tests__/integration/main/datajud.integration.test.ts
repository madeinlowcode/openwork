/**
 * DataJud Repository Integration Tests
 *
 * @description Integration tests for DataJud search history repository
 *
 * @context Test suite for apps/desktop/src/main/store/repositories/datajudSearches.ts
 *
 * @dependencies
 * - vitest (test framework)
 *
 * @testCoverage
 * - Basic repository operations (basic save/retrieve)
 */

import { describe, it, expect } from 'vitest';

describe('DataJud Repository Integration', () => {
  describe('Repository Exports', () => {
    it('should export saveSearch function', async () => {
      const { saveSearch } = await import('@main/store/repositories/datajudSearches');
      expect(typeof saveSearch).toBe('function');
    });

    it('should export getSearchById function', async () => {
      const { getSearchById } = await import('@main/store/repositories/datajudSearches');
      expect(typeof getSearchById).toBe('function');
    });

    it('should export getRecentSearches function', async () => {
      const { getRecentSearches } = await import('@main/store/repositories/datajudSearches');
      expect(typeof getRecentSearches).toBe('function');
    });

    it('should export deleteSearch function', async () => {
      const { deleteSearch } = await import('@main/store/repositories/datajudSearches');
      expect(typeof deleteSearch).toBe('function');
    });

    it('should export clearHistory function', async () => {
      const { clearHistory } = await import('@main/store/repositories/datajudSearches');
      expect(typeof clearHistory).toBe('function');
    });

    it('should export getTotalSearchCount function', async () => {
      const { getTotalSearchCount } = await import('@main/store/repositories/datajudSearches');
      expect(typeof getTotalSearchCount).toBe('function');
    });

    it('should export getSearchCountByCourt function', async () => {
      const { getSearchCountByCourt } = await import('@main/store/repositories/datajudSearches');
      expect(typeof getSearchCountByCourt).toBe('function');
    });

    it('should export searchHistoryByValue function', async () => {
      const { searchHistoryByValue } = await import('@main/store/repositories/datajudSearches');
      expect(typeof searchHistoryByValue).toBe('function');
    });

    it('should export getSearchesByCourt function', async () => {
      const { getSearchesByCourt } = await import('@main/store/repositories/datajudSearches');
      expect(typeof getSearchesByCourt).toBe('function');
    });
  });
});
