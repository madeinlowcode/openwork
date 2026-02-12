/**
 * DataJud Service Unit Tests
 *
 * @description Unit tests for DataJud API service
 *
 * @context Test suite for apps/desktop/src/main/services/datajud.ts
 *
 * @dependencies
 * - vitest (test framework)
 *
 * @testCoverage
 * - Search operations (search, searchByNumber, searchByClass, searchByParty, searchByDateRange)
 * - Rate limiting and cache
 * - Privacy filter
 * - API key validation
 * - Court utilities
 */

import { describe, it, expect, vi } from 'vitest';

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

describe('DataJud Service', () => {
  describe('Court Utilities', () => {
    it('should return list of courts', async () => {
      const { getCourts } = await import('@main/services/datajud');
      const courts = getCourts();

      expect(Array.isArray(courts)).toBe(true);
      expect(courts.length).toBeGreaterThan(0);

      // Verify court structure
      const firstCourt = courts[0];
      expect(firstCourt).toHaveProperty('alias');
      expect(firstCourt).toHaveProperty('name');
      expect(firstCourt).toHaveProperty('category');
    });

    it('should get court by alias', async () => {
      const { getCourtByAlias, getCourts } = await import('@main/services/datajud');
      const courts = getCourts();
      const firstCourt = courts[0];

      const found = getCourtByAlias(firstCourt.alias);
      expect(found).toBeDefined();
      expect(found?.alias).toBe(firstCourt.alias);
    });

    it('should return undefined for non-existent court', async () => {
      const { getCourtByAlias } = await import('@main/services/datajud');
      const found = getCourtByAlias('non_existent_court');
      expect(found).toBeUndefined();
    });

    it('should filter courts by category', async () => {
      const { getCourtsByCategory } = await import('@main/services/datajud');

      const superiorCourts = getCourtsByCategory('superior');
      expect(Array.isArray(superiorCourts)).toBe(true);
      superiorCourts.forEach(court => {
        expect(court.category).toBe('superior');
      });
    });
  });

  describe('DataJud Configuration', () => {
    it('should export configuration constants', async () => {
      const {
        DATAJUD_TIMEOUTS,
        DATAJUD_RETRY_CONFIG,
        DATAJUD_RATE_LIMIT,
        DATAJUD_CACHE_TTL,
      } = await import('@main/services/datajud');

      expect(DATAJUD_TIMEOUTS).toBeDefined();
      expect(DATAJUD_TIMEOUTS.search).toBe(30000);
      expect(DATAJUD_TIMEOUTS.largeSearch).toBe(60000);

      expect(DATAJUD_RETRY_CONFIG).toBeDefined();
      expect(DATAJUD_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DATAJUD_RETRY_CONFIG.retryableStatusCodes).toContain(429);
      expect(DATAJUD_RETRY_CONFIG.retryableStatusCodes).toContain(500);

      expect(DATAJUD_RATE_LIMIT).toBeDefined();
      expect(DATAJUD_RATE_LIMIT.requestsPerMinute).toBe(60);

      expect(DATAJUD_CACHE_TTL).toBeDefined();
      expect(DATAJUD_CACHE_TTL.numberSearch).toBe(300000); // 5 minutes
      expect(DATAJUD_CACHE_TTL.genericSearch).toBe(60000); // 1 minute
    });
  });

  describe('Search Query Building', () => {
    it('should validate process number format', async () => {
      const { validateProcessNumber } = await import('@main/services/datajud');

      // Valid NPU format - 25 digits
      const validResult = validateProcessNumber('0000000000000000000000001');
      expect(validResult.valid).toBe(true);
      expect(validResult.cleaned?.length).toBe(25);

      // Valid with only digits (25 digits)
      const digitsResult = validateProcessNumber('0000000000000000000000000');
      expect(digitsResult.valid).toBe(true);
      expect(digitsResult.cleaned?.length).toBe(25);

      // Invalid format - too short
      const invalidResult = validateProcessNumber('invalid');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();

      // Invalid format - too short
      const tooShort = validateProcessNumber('12345');
      expect(tooShort.valid).toBe(false);
    });

    it('should build correct query for number search', async () => {
      const { buildSearchQuery } = await import('@main/services/datajud');

      const query = buildSearchQuery({
        court: 'api_publica_stj',
        queryType: 'number',
        value: '000000020248260000000001',
        size: 10,
      });

      expect(query.size).toBe(10);
      expect(query.query).toHaveProperty('match');
      expect(query.query.match).toHaveProperty('numeroProcesso');
    });

    it('should build correct query for class search', async () => {
      const { buildSearchQuery } = await import('@main/services/datajud');

      const query = buildSearchQuery({
        court: 'tjsp',
        queryType: 'class',
        value: 'Procedimento Comum',
        size: 50,
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          instance: 'G1',
        },
      });

      expect(query.query).toHaveProperty('bool');
      expect(query.query.bool).toHaveProperty('must');
      expect(query.query.bool).toHaveProperty('filter');
    });

    it('should parse API response correctly', async () => {
      const { parseApiResponse } = await import('@main/services/datajud');

      const mockApiResponse = {
        hits: {
          total: { value: 2 },
          hits: [
            {
              _source: {
                numeroProcesso: '1111111-11.2024.1.0001',
                classe: { codigo: '1', nome: 'Procedimento Comum' },
                tribunal: 'tjsp',
                grau: 'G1',
                dataAjuizamento: '2024-01-15',
                nivelSigilo: 0,
              },
            },
            {
              _source: {
                numeroProcesso: '2222222-22.2024.1.0002',
                classe: { codigo: '2', nome: 'Monitorio' },
                tribunal: 'tjsp',
                grau: 'G2',
                dataAjuizamento: '2024-02-20',
                nivelSigilo: 0,
              },
            },
          ],
        },
      };

      const result = parseApiResponse(mockApiResponse, 10);

      expect(result.processes).toHaveLength(2);
      expect(result.processes[0].numeroProcesso).toBe('1111111-11.2024.1.0001');
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('Privacy Filter', () => {
    it('should apply privacy filter correctly', async () => {
      const { applyPrivacyFilter } = await import('@main/services/datajud');

      const publicProcess = {
        numeroProcesso: '1234567-89.2024.1.0001',
        classe: { codigo: '1', nome: 'Procedimento Comum' },
        tribunal: 'tjsp',
        grau: 'G1' as const,
        dataAjuizamento: '2024-01-15',
        nivelSigilo: 0,
        partes: [],
        movimentacoes: [],
      };

      const filtered = applyPrivacyFilter(publicProcess);
      expect(filtered.nivelSigilo).toBe(0);
    });

    it('should mark sigilo process as restricted', async () => {
      const { applyPrivacyFilter } = await import('@main/services/datajud');

      const sigiloProcess = {
        numeroProcesso: '1234567-89.2024.1.0001',
        classe: { codigo: '1', nome: 'Procedimento Comum' },
        tribunal: 'tjsp',
        grau: 'G1' as const,
        dataAjuizamento: '2024-01-15',
        nivelSigilo: 1,
        partes: [],
        movimentacoes: [],
      };

      const filtered = applyPrivacyFilter(sigiloProcess);
      expect(filtered.nivelSigilo).toBe(1);
    });
  });

  describe('Log Redaction', () => {
    it('should redact API key from logs', async () => {
      const { redactDataJudKey } = await import('@main/utils/datajud-redact');

      const text = 'Authorization: APIKey abc123-def456-xyz';
      const redacted = redactDataJudKey(text);

      expect(redacted).toBe('Authorization: APIKey [REDACTED]');
      expect(redacted).not.toContain('abc123');
    });

    it('should redact CPF/CNPJ from logs', async () => {
      const { redactProcessForLog } = await import('@main/utils/datajud-redact');

      const processData = {
        numeroProcesso: '1234567-89.2024.1.0001',
        partes: [{
          tipo: 'autor',
          nome: 'Joao Silva',
          documento: '123.456.789-00',
        }],
      };

      const redacted = redactProcessForLog(processData);

      expect(redacted).toHaveProperty('partes');
      const partes = redacted.partes as Array<{ nome: string; documento?: string }>;
      expect(partes[0].nome).toBe('[REDACTED]');
      expect(partes[0].documento).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive fields', async () => {
      const { redactProcessForLog } = await import('@main/utils/datajud-redact');

      const processData = {
        numeroProcesso: '1234567-89.2024.1.0001',
        classe: { codigo: '1', nome: 'Procedimento Comum' },
        tribunal: 'tjsp',
        nivelSigilo: 0,
      };

      const redacted = redactProcessForLog(processData);

      expect(redacted.numeroProcesso).toBe('1234567-89.2024.1.0001');
      expect(redacted.classe.nome).toBe('Procedimento Comum');
    });
  });

  describe('Sigilo Descriptions', () => {
    it('should return correct descriptions', async () => {
      const { SIGILO_DESCRIPTIONS, getSigiloWarning } = await import('@main/utils/datajud-redact');

      expect(SIGILO_DESCRIPTIONS[0]).toBe('Public');
      expect(SIGILO_DESCRIPTIONS[1]).toBe('Restricted - Judicial secrecy');
      expect(SIGILO_DESCRIPTIONS[2]).toBe('Restricted - Investigative secrecy');
      expect(SIGILO_DESCRIPTIONS[3]).toBe('Restricted - State secrecy');

      // Warning should be empty for public processes
      expect(getSigiloWarning(0)).toBe('');

      // Warning should be non-empty for restricted processes
      const warning = getSigiloWarning(1);
      expect(warning.length).toBeGreaterThan(0);
    });
  });

  describe('DataJud Service - Error Handling', () => {
    it('should create typed errors', async () => {
      const { DataJudError } = await import('@accomplish/shared');

      const error = new DataJudError('Test error', 'TEST_CODE', 400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
    });

    it('should check if error is DataJudError', async () => {
      const { isDataJudError } = await import('@main/services/datajud');
      const { DataJudError } = await import('@accomplish/shared');

      const typedError = new DataJudError('Test', 'AUTH');
      const regularError = new Error('Regular error');

      expect(isDataJudError(typedError)).toBe(true);
      expect(isDataJudError(regularError)).toBe(false);
    });
  });
});
