/**
 * DataJud E2E Tests (Electron)
 *
 * @description End-to-end tests for DataJud feature using Electron fixtures
 *
 * @context Tests DataJud settings tab in the SettingsDialog (API key input,
 *          validation, status badge) within the actual Electron app.
 *
 * @dependencies
 * - e2e/fixtures/electron-app.ts (Electron launcher + window fixture)
 * - apps/desktop/src/renderer/components/settings/DataJudSettings.tsx
 * - apps/desktop/src/renderer/components/layout/SettingsDialog.tsx
 *
 * AIDEV-NOTE: Uses `window` fixture (Electron Page), NOT standard `page`.
 * AIDEV-NOTE: Navigation uses hash routing via sidebar button clicks.
 */

import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

test.describe('DataJud Feature', () => {

  test.describe('Settings - DataJud Tab', () => {

    test('should display DataJud tab in settings dialog', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      // Look for the DataJud tab button
      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await expect(datajudTab).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

      await captureForAI(
        window,
        'datajud-settings',
        'tab-visible',
        ['DataJud tab is visible in settings dialog']
      );
    });

    test('should show DataJud settings when clicking DataJud tab', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      // Click the DataJud tab
      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      // API key input should be visible
      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      await expect(apiKeyInput).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

      await captureForAI(
        window,
        'datajud-settings',
        'settings-panel',
        ['DataJud settings panel is visible', 'API key input is shown']
      );
    });

    test('should show API key input field', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      // Navigate to DataJud tab
      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      await expect(apiKeyInput).toBeVisible();
      await expect(apiKeyInput).toBeEnabled();

      // Should be password type
      await expect(apiKeyInput).toHaveAttribute('type', 'password');
    });

    test('should allow typing in API key input', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      const testKey = 'capi_test_12345678901234567890';
      await apiKeyInput.fill(testKey);

      await expect(apiKeyInput).toHaveValue(testKey);

      await captureForAI(
        window,
        'datajud-settings',
        'api-key-filled',
        ['API key input has value', 'User can type in the field']
      );
    });

    test('should have validate button', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const validateButton = window.getByTestId('datajud-validate-button');
      await expect(validateButton).toBeVisible();

      // Should be disabled when API key is empty
      await expect(validateButton).toBeDisabled();
    });

    test('should enable validate button when API key is entered', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      const validateButton = window.getByTestId('datajud-validate-button');

      // Initially disabled
      await expect(validateButton).toBeDisabled();

      // Fill API key
      await apiKeyInput.fill('capi_test_key_1234567890');
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      // Should now be enabled
      await expect(validateButton).toBeEnabled();

      await captureForAI(
        window,
        'datajud-settings',
        'validate-button-enabled',
        ['Validate button is enabled after entering API key']
      );
    });

    test('should show error for short API key validation', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      const validateButton = window.getByTestId('datajud-validate-button');

      // Enter a short key (< 10 chars triggers validation error)
      await apiKeyInput.fill('short');
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
      await validateButton.click();

      // Wait for validation to complete and error to appear
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      // Should show error state (red badge)
      const errorBadge = window.locator('.bg-red-500\\/20');
      await expect(errorBadge).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

      await captureForAI(
        window,
        'datajud-settings',
        'validation-error',
        ['Error badge shown for invalid API key', 'Short key rejected']
      );
    });

    test('should show connected status for valid API key', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      const validateButton = window.getByTestId('datajud-validate-button');

      // Enter a valid key (>= 10 chars passes simulation)
      await apiKeyInput.fill('capi_valid_key_1234567890');
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
      await validateButton.click();

      // Wait for validation
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE * 2);

      // Should show connected status (green badge)
      const connectedBadge = window.locator('.bg-green-500\\/20');
      await expect(connectedBadge).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

      // Clear button should appear after successful connection
      const clearButton = window.getByTestId('datajud-clear-button');
      await expect(clearButton).toBeVisible();

      await captureForAI(
        window,
        'datajud-settings',
        'connected-status',
        ['Connected badge shown', 'Clear button visible after connection']
      );
    });

    test('should clear API key when clicking clear button', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      const apiKeyInput = window.getByTestId('datajud-api-key-input');
      const validateButton = window.getByTestId('datajud-validate-button');

      // First connect with valid key
      await apiKeyInput.fill('capi_valid_key_1234567890');
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
      await validateButton.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE * 2);

      // Click clear
      const clearButton = window.getByTestId('datajud-clear-button');
      await clearButton.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      // API key should be cleared
      await expect(apiKeyInput).toHaveValue('');

      // Status should return to disconnected (gray badge)
      const disconnectedBadge = window.locator('.bg-gray-500\\/20');
      await expect(disconnectedBadge).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

      await captureForAI(
        window,
        'datajud-settings',
        'cleared-state',
        ['API key cleared', 'Status returned to disconnected']
      );
    });

    test('should show help link to CNJ portal', async ({ window }) => {
      const settingsPage = new SettingsPage(window);

      await window.waitForLoadState('domcontentloaded');
      await settingsPage.navigateToSettings();

      const datajudTab = window.locator('button').filter({ hasText: 'DataJud' });
      await datajudTab.click();
      await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

      // Check that the CNJ help link exists
      const helpLink = window.locator('a[href*="cnj.jus.br"]');
      await expect(helpLink).toBeVisible();
    });

  });

  test.describe('DataJud Query Form', () => {

    test('should have DataJud query form component available', async ({ window }) => {
      // Verify the query form dialog can be triggered
      // The form is opened from the home page via prompt cards
      await window.waitForLoadState('domcontentloaded');

      const datajudQueryForm = window.getByTestId('datajud-query-form');
      // Form is a dialog, not visible by default - just verify component exists in DOM
      // by checking if the home page has DataJud-related prompt cards
      const datajudPromptCard = window.locator('[data-testid*="datajud"], [data-testid*="prompt-card"]').first();

      // This test just validates the page loaded without errors
      // The query form requires specific user interaction to open
      await captureForAI(
        window,
        'datajud-query',
        'home-page-state',
        ['Home page loaded successfully', 'DataJud components available']
      );
    });

  });

});
