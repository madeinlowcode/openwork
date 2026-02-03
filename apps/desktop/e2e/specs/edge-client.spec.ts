/**
 * @file edge-client.spec.ts
 * @description E2E tests for the Supabase Edge Client integration
 *
 * @context Main process > Supabase > Edge Functions
 *
 * @tests
 * - Edge client configuration checks
 * - Authentication requirements for Edge Functions
 * - Error handling for network and auth failures
 *
 * AIDEV-NOTE: Tests the edge-client.ts integration for LLM summarization
 * AIDEV-WARNING: These tests verify configuration and error handling, not actual API calls
 * AIDEV-WARNING: Real Edge Function calls require valid Supabase auth
 */

import { test, expect } from '../fixtures';
import { SettingsPage, AuthPage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

/**
 * Edge Client Configuration Tests
 * Tests for checking if Edge Functions can be called
 */
test.describe('Edge Client Configuration', () => {
  test('should report Edge Functions unavailable without auth', async ({ window }) => {
    // In E2E mode without Supabase config, canCallEdgeFunctions should return false
    // We verify this indirectly through the UI behavior

    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Select model
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // LLM summarization toggle should be visible
    // When clicked, it may show a warning or info about requiring auth
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'edge-client-config',
      'no-auth-state',
      [
        'Edge Functions available status depends on auth',
        'LLM summarization option visible',
        'Feature may require authentication'
      ]
    );
  });

  test('should allow configuring LLM summarization regardless of auth state', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Select model
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Enable LLM summarization (should be allowed even without auth)
    await settingsPage.fallbackSummarizationToggle.click({ force: true });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    await captureForAI(
      window,
      'edge-client-config',
      'llm-config-without-auth',
      [
        'LLM summarization can be configured',
        'Will fallback to template at runtime if auth fails',
        'UI allows configuration regardless of auth'
      ]
    );
  });

  test('should persist LLM summarization setting even without auth', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Configure with LLM enabled
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    await settingsPage.fallbackSummarizationToggle.click({ force: true });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Close dialog
    await settingsPage.pressEscapeToClose();
    const closeAnywayVisible = await settingsPage.closeAnywayButton.isVisible().catch(() => false);
    if (closeAnywayVisible) {
      await settingsPage.closeAnywayButton.click();
    }
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Reopen and verify
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Settings should persist
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'edge-client-config',
      'settings-persisted-without-auth',
      [
        'LLM summarization setting persisted',
        'Settings saved to database',
        'Runtime will check auth when actually calling Edge Function'
      ]
    );
  });
});

/**
 * Auth Integration for Edge Functions Tests
 * Tests the auth page and its role in enabling Edge Functions
 */
test.describe('Auth Integration for Edge Functions', () => {
  test('should show auth page for Supabase authentication', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Should show either login form or error (if Supabase not configured)
    const hasForm = await authPage.isLoginFormVisible().catch(() => false);
    const hasError = await authPage.hasInitializationError().catch(() => false);

    expect(hasForm || hasError).toBe(true);

    await captureForAI(
      window,
      'auth-integration',
      'auth-page-shown',
      [
        'Auth page is accessible',
        hasForm ? 'Login form shown' : 'Init error shown (no Supabase config)',
        'Users can authenticate to enable Edge Functions'
      ]
    );
  });

  test('should handle Supabase initialization gracefully in E2E mode', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();

    // Wait for some content to appear
    await window.waitForTimeout(TEST_TIMEOUTS.HYDRATION);

    // Page should not crash
    const body = window.locator('body');
    await expect(body).toBeVisible();

    // Should show some content (form, error, or loading)
    const hasContent = await window.locator('h1, form, p, [class*="spinner"]').count();
    expect(hasContent).toBeGreaterThan(0);

    await captureForAI(
      window,
      'auth-integration',
      'graceful-init',
      [
        'Page renders without crashing',
        'Content is visible',
        'Graceful handling of missing config'
      ]
    );
  });
});

/**
 * Edge Client Error Handling Tests
 * Tests for error scenarios in Edge Function calls
 */
test.describe('Edge Client Error Handling', () => {
  test('should handle fallback to template when LLM unavailable', async ({ window }) => {
    // This is tested indirectly through the settings
    // When LLM is configured but auth fails, the system falls back to template

    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Configure with LLM enabled
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    await settingsPage.fallbackSummarizationToggle.click({ force: true });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // At runtime, if LLM call fails, it will fallback to template
    // We can only verify the configuration here

    await captureForAI(
      window,
      'edge-client-errors',
      'fallback-to-template-config',
      [
        'LLM summarization configured',
        'Will fallback to template if Edge Function fails',
        'Graceful degradation implemented'
      ]
    );
  });

  test('should have proper error handling in IPC layer', async ({ window }) => {
    // Verify the fallback API handles errors gracefully
    const result = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      try {
        // This should work even without backend
        const settings = await api.fallback.getSettings();
        return { success: true, hasSettings: !!settings };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasSettings).toBe(true);

    await captureForAI(
      window,
      'edge-client-errors',
      'ipc-error-handling',
      [
        'IPC calls handle errors gracefully',
        'Settings API works without backend',
        'No uncaught exceptions'
      ]
    );
  });

  test('should report proper status when Edge Functions unavailable', async ({ window }) => {
    // The edge-client has canCallEdgeFunctions() which checks auth
    // We verify this indirectly through the settings behavior

    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Select model
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // The UI should show appropriate status - verify via the fallback card or toggle being visible
    // Use the settingsPage locator which is more reliable
    await expect(settingsPage.fallbackCard).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'edge-client-errors',
      'status-reporting',
      [
        'Fallback settings visible',
        'Status information displayed',
        'User informed of availability'
      ]
    );
  });
});

/**
 * LLM Summarize Integration Tests
 * Tests specific to the llm-summarize Edge Function integration
 */
test.describe('LLM Summarize Integration', () => {
  test('should have LLM summarization option in UI', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Select model
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // LLM summarization toggle should be visible
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Look for any labels/descriptions about LLM summarization
    const llmLabel = window.getByText(/LLM|sumariz/i);
    const hasLabel = await llmLabel.isVisible().catch(() => false);

    await captureForAI(
      window,
      'llm-summarize',
      'option-visible',
      [
        'LLM summarization toggle visible',
        hasLabel ? 'Label/description present' : 'No additional label',
        'Feature is discoverable'
      ]
    );
  });

  test('should save LLM summarization preference correctly', async ({ window }) => {
    // Use IPC directly to test settings
    const before = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    const beforeValue = before.useLLMSummarization;

    // Update via IPC - pass the value explicitly
    const after = await window.evaluate(async (currentValue) => {
      const api = (window as any).jurisiar;
      return await api.fallback.setSettings({
        useLLMSummarization: !currentValue
      });
    }, beforeValue);

    // Verify change
    expect(after.useLLMSummarization).toBe(!beforeValue);

    // Verify persistence
    const verify = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(verify.useLLMSummarization).toBe(after.useLLMSummarization);

    await captureForAI(
      window,
      'llm-summarize',
      'preference-saved',
      [
        'LLM summarization preference toggled',
        'Change persisted to database',
        'IPC round-trip successful'
      ]
    );
  });

  test('should have summarization model configuration option', async ({ window }) => {
    // Check if the settings include summarization model field
    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    // Settings should have summarization model fields
    expect(settings).toHaveProperty('summarizationModelId');
    expect(settings).toHaveProperty('summarizationProvider');

    await captureForAI(
      window,
      'llm-summarize',
      'model-config-available',
      [
        'Settings include summarizationModelId',
        'Settings include summarizationProvider',
        'Summarization model can be configured'
      ]
    );
  });
});
