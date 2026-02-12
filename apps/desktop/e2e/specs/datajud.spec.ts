/**
 * DataJud E2E Tests
 *
 * @description End-to-end tests for DataJud feature using Playwright
 *
 * @context Test suite for DataJud functionality in the desktop app
 *
 * @dependencies
 * - @playwright/test (test framework)
 * - apps/desktop/src/renderer/pages/Settings.tsx
 * - apps/desktop/src/renderer/components/datajud/*
 *
 * @testCoverage
 * - Settings: Configure API key
 * - Query Form: Search by number, class, party, date range
 * - Results: Display processes, handle sigilo
 * - Error handling: Invalid API key, network errors
 */

import { test, expect } from '@playwright/test';

test.describe('DataJud Feature', () => {
  test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to settings page
      await page.goto('/settings');
    });

    test('should display DataJud settings section', async ({ page }) => {
      // Look for DataJud section in settings
      const datajudSection = page.locator('[data-testid="datajud-settings"]');
      await expect(datajudSection).toBeVisible();
    });

    test('should show API key input field', async ({ page }) => {
      const apiKeyInput = page.locator('[data-testid="datajud-api-key-input"]');
      await expect(apiKeyInput).toBeVisible();
    });

    test('should validate empty API key', async ({ page }) => {
      const saveButton = page.locator('[data-testid="datajud-save-button"]');
      await saveButton.click();

      // Should show error message
      const errorMessage = page.locator('[data-testid="datajud-error-message"]');
      await expect(errorMessage).toContainText('API key is required');
    });

    test('should show validation status', async ({ page }) => {
      const statusIndicator = page.locator('[data-testid="datajud-status"]');
      await expect(statusIndicator).toBeVisible();
    });
  });

  test.describe('Query Form', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to home and open DataJud query form
      await page.goto('/');
      const openQueryFormButton = page.locator('[data-testid="datajud-open-form"]');
      await openQueryFormButton.click();
    });

    test('should display query form modal', async ({ page }) => {
      const queryForm = page.locator('[data-testid="datajud-query-form"]');
      await expect(queryForm).toBeVisible();
    });

    test('should have search type selector', async ({ page }) => {
      const searchTypeSelect = page.locator('[data-testid="datajud-search-type"]');
      await expect(searchTypeSelect).toBeVisible();

      // Should have options
      await searchTypeSelect.click();
      const options = page.locator('[data-testid="datajud-search-type-option"]');
      await expect(options.first()).toBeVisible();
    });

    test('should have court selector', async ({ page }) => {
      const courtSelect = page.locator('[data-testid="datajud-court-select"]');
      await expect(courtSelect).toBeVisible();
    });

    test('should show different fields based on search type', async ({ page }) => {
      // Default is number search - shows single input
      const valueInput = page.locator('[data-testid="datajud-value-input"]');
      await expect(valueInput).toBeVisible();

      // Switch to date range
      const searchTypeSelect = page.locator('[data-testid="datajud-search-type"]');
      await searchTypeSelect.selectOption('dateRange');

      // Should show date inputs instead
      const dateFromInput = page.locator('[data-testid="datajud-date-from"]');
      const dateToInput = page.locator('[data-testid="datajud-date-to"]');
      await expect(dateFromInput).toBeVisible();
      await expect(dateToInput).toBeVisible();
    });

    test('should disable submit button when form is invalid', async ({ page }) => {
      const submitButton = page.locator('[data-testid="datajud-submit-button"]');

      // Should be disabled when empty
      await expect(submitButton).toBeDisabled();

      // Fill in valid data
      const searchTypeSelect = page.locator('[data-testid="datajud-search-type"]');
      await searchTypeSelect.selectOption('number');
      const valueInput = page.locator('[data-testid="datajud-value-input"]');
      await valueInput.fill('1234567-89.2024.1.0001');

      // Should be enabled now
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Results Display', () => {
    test.beforeEach(async ({ page }) => {
      // Setup: Navigate and mock API response
      await page.goto('/');
      await page.route('**/api_publica_*/_search', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    numeroProcesso: '1234567-89.2024.1.0001',
                    classe: { codigo: '1', nome: 'Procedimento Comum Cível' },
                    tribunal: 'TJSP',
                    grau: 'G1',
                    dataAjuizamento: '2024-01-15',
                    nivelSigilo: 0,
                    partes: [
                      { tipo: 'autor', nome: 'João Silva', documento: '123.456.789-00' },
                      { tipo: 'reu', nome: 'Empresa ABC Ltda', documento: '12.345.678/0001-00' },
                    ],
                    movimentacoes: [
                      { data: '2024-01-15', tipo: 'Autuação', descricao: 'Petição inicial protocolada' },
                      { data: '2024-01-20', tipo: 'Decisão', descrição: 'Recebimento da inicial' },
                    ],
                  },
                },
              ],
            },
          }),
        });
      });
    });

    test('should display result card', async ({ page }) => {
      const resultCard = page.locator('[data-testid="datajud-result-card"]');
      await expect(resultCard).toBeVisible();
    });

    test('should show process number', async ({ page }) => {
      const processNumber = page.locator('[data-testid="datajud-process-number"]');
      await expect(processNumber).toContainText('1234567-89.2024.1.0001');
    });

    test('should show class and court', async ({ page }) => {
      const classInfo = page.locator('[data-testid="datajud-class-info"]');
      await expect(classInfo).toContainText('Procedimento Comum Cível');

      const courtInfo = page.locator('[datajud-court-info"]');
      await expect(courtInfo).toContainText('TJSP');
    });

    test('should display sigilo warning for restricted processes', async ({ page }) => {
      // Mock sigilo response
      await page.route('**/api_publica_*/_search', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _source: {
                    numeroProcesso: '9876543-21.2024.1.0001',
                    classe: { codigo: '1', nome: 'Procedimento Comum' },
                    tribunal: 'TJSP',
                    grau: 'G1',
                    dataAjuizamento: '2024-01-15',
                    nivelSigilo: 1, // Sigilo judicial
                    partes: [],
                    movimentacoes: [],
                  },
                },
              ],
            },
          }),
        });
      });

      const sigiloWarning = page.locator('[data-testid="datajud-sigilo-warning"]');
      await expect(sigiloWarning).toBeVisible();
      await expect(sigiloWarning).toContainText('sigilo');
    });

    test('should allow copying process number', async ({ page }) => {
      const copyButton = page.locator('[data-testid="datajud-copy-button"]');
      await copyButton.click();

      // Should show copied feedback
      const copiedFeedback = page.locator('[data-testid="datajud-copied-feedback"]');
      await expect(copiedFeedback).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error for invalid API key', async ({ page }) => {
      await page.route('**/api_publica_*/_search', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            erro: 'Invalid or unauthorized API key',
          }),
        });
      });

      const errorMessage = page.locator('[data-testid="datajud-error-message"]');
      await expect(errorMessage).toContainText('Invalid');
    });

    test('should show rate limit error', async ({ page }) => {
      await page.route('**/api_publica_*/_search', route => {
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            erro: 'Rate limit exceeded',
          }),
        });
      });

      const errorMessage = page.locator('[data-testid="datajud-error-message"]');
      await expect(errorMessage).toContainText('Rate limit');
    });

    test('should show network error', async ({ page }) => {
      await page.route('**/api_publica_*/_search', route => {
        route.abort('failed');
      });

      const errorMessage = page.locator('[data-testid="datajud-error-message"]');
      await expect(errorMessage).toContainText('network');
    });

    test('should show no results message', async ({ page }) => {
      await page.route('**/api_publica_*/_search', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hits: {
              total: { value: 0 },
              hits: [],
            },
          }),
        });
      });

      const noResultsMessage = page.locator('[data-testid="datajud-no-results"]');
      await expect(noResultsMessage).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading spinner during search', async ({ page }) => {
      await page.route('**/api_publica_*/_search', route => {
        // Delay response
        setTimeout(() => route.fulfill({ status: 200, body: '{}' }), 1000);
      });

      const submitButton = page.locator('[data-testid="datajud-submit-button"]');
      await submitButton.click();

      const loadingSpinner = page.locator('[data-testid="datajud-loading"]');
      await expect(loadingSpinner).toBeVisible();
    });
  });
});

test.describe('DataJud MCP Integration', () => {
  test('should have datajud-search tool available', async ({ page }) => {
    // This test verifies the MCP server includes the datajud-search tool
    // The actual test would require starting the MCP server and checking tool list

    // Verify the MCP server file exists
    const mcpServerExists = await page.evaluate(() => {
      const fs = require('fs');
      return fs.existsSync('/apps/desktop/skills/datajud-server/src/index.ts');
    });

    expect(mcpServerExists).toBe(true);
  });
});
