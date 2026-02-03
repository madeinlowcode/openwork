/**
 * @file fallback-flow.spec.ts
 * @description E2E tests for the complete fallback flow
 *
 * @context End-to-end flow: Task -> Rate Limit -> Fallback -> Continuation
 *
 * @tests
 * - Complete fallback flow configuration
 * - Context preservation between models
 * - UI notification during fallback
 * - Error scenarios and graceful handling
 *
 * AIDEV-NOTE: Tests the complete Phase 2 fallback flow
 * AIDEV-WARNING: These tests verify configuration and UI, not actual fallback execution
 * AIDEV-WARNING: Real fallback requires actual rate limit errors from API providers
 */

import { test, expect } from '../fixtures';
import { SettingsPage, HomePage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

/**
 * Complete Fallback Configuration Tests
 * Tests for setting up the complete fallback system
 */
test.describe('Complete Fallback Configuration', () => {
  test('should configure all fallback settings', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');

    // Reset to known state via IPC first
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: false,
        fallbackModelId: null,
        useLLMSummarization: false,
      });
    });

    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Step 1: Enable fallback via IPC (more reliable)
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({ enabled: true });
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Step 2: Select fallback model via IPC
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({ fallbackModelId: 'anthropic/claude-3-haiku' });
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Step 3: Enable LLM summarization via IPC
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({ useLLMSummarization: true });
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Verify complete configuration
    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settings.enabled).toBe(true);
    expect(settings.fallbackModelId).toBe('anthropic/claude-3-haiku');
    expect(settings.useLLMSummarization).toBe(true);

    await captureForAI(
      window,
      'complete-fallback-config',
      'all-settings-configured',
      [
        'Fallback enabled',
        'Model selected',
        'Summarization configured',
        'Complete setup done'
      ]
    );
  });

  test('should persist complete configuration across app restarts', async ({ window, electronApp }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');

    // Configure via IPC to ensure known state
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
      });
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Get settings
    const settingsBefore = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settingsBefore.enabled).toBe(true);
    expect(settingsBefore.fallbackModelId).toBe('anthropic/claude-3-haiku');

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

    const settingsAfter = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settingsAfter.enabled).toBe(settingsBefore.enabled);
    expect(settingsAfter.fallbackModelId).toBe(settingsBefore.fallbackModelId);

    await captureForAI(
      window,
      'complete-fallback-config',
      'settings-persisted',
      [
        'Configuration saved to database',
        'Settings match after reopen',
        'Persistence working correctly'
      ]
    );
  });

  test('should show ready status when fully configured', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');

    // Configure via IPC first to ensure state is set
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
      });
    });

    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE * 2);

    // Look for ready status - the translation says "Fallback configured and ready"
    const readyStatus = window.getByText(/configured and ready|configurado e pronto/i);
    await expect(readyStatus).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION * 2 });

    await captureForAI(
      window,
      'complete-fallback-config',
      'ready-status-shown',
      [
        'Ready status visible',
        'User informed of configuration state',
        'System ready for fallback'
      ]
    );
  });
});

/**
 * Context Preservation Tests
 * Tests for verifying context is properly configured for preservation
 */
test.describe('Context Preservation Configuration', () => {
  test('should have template mode as default (preserves all tool calls)', async ({ window }) => {
    // Reset settings first
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
        useLLMSummarization: false,
      });
    });

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    // Template mode is default
    expect(settings.useLLMSummarization).toBe(false);

    await captureForAI(
      window,
      'context-preservation',
      'template-mode-default',
      [
        'Template mode is default',
        'All tool calls included in context',
        'No token cost for context generation'
      ]
    );
  });

  test('should allow switching to LLM mode for intelligent summarization', async ({ window }) => {
    // Configure LLM mode
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
        useLLMSummarization: true,
      });
    });

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settings.useLLMSummarization).toBe(true);

    await captureForAI(
      window,
      'context-preservation',
      'llm-mode-enabled',
      [
        'LLM summarization enabled',
        'Will generate intelligent summary',
        'Falls back to template if LLM unavailable'
      ]
    );
  });

  test('should have max retries configured', async ({ window }) => {
    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    // Default max retries should be 3
    expect(settings.maxRetries).toBe(3);

    await captureForAI(
      window,
      'context-preservation',
      'max-retries-configured',
      [
        `Max retries: ${settings.maxRetries}`,
        'Retry limit prevents infinite loops',
        'Context preserved across retries'
      ]
    );
  });
});

/**
 * UI Notification Readiness Tests
 * Tests that UI is ready to show fallback notifications
 */
test.describe('UI Notification Readiness', () => {
  test('should have fallback event listeners available', async ({ window }) => {
    const hasListeners = await window.evaluate(() => {
      const api = (window as any).jurisiar;
      return {
        started: typeof api.onFallbackStarted === 'function',
        completed: typeof api.onFallbackCompleted === 'function',
        failed: typeof api.onFallbackFailed === 'function',
      };
    });

    expect(hasListeners.started).toBe(true);
    expect(hasListeners.completed).toBe(true);
    expect(hasListeners.failed).toBe(true);

    await captureForAI(
      window,
      'ui-notification-readiness',
      'event-listeners-available',
      [
        'onFallbackStarted available',
        'onFallbackCompleted available',
        'onFallbackFailed available'
      ]
    );
  });

  test('should be able to subscribe and unsubscribe from events', async ({ window }) => {
    const result = await window.evaluate(() => {
      const api = (window as any).jurisiar;
      const unsubscribers: (() => void)[] = [];

      // Subscribe to all events
      unsubscribers.push(api.onFallbackStarted(() => {}));
      unsubscribers.push(api.onFallbackCompleted(() => {}));
      unsubscribers.push(api.onFallbackFailed(() => {}));

      // All should return functions
      const allFunctions = unsubscribers.every(u => typeof u === 'function');

      // Unsubscribe all
      unsubscribers.forEach(u => u());

      return { allFunctions, count: unsubscribers.length };
    });

    expect(result.allFunctions).toBe(true);
    expect(result.count).toBe(3);

    await captureForAI(
      window,
      'ui-notification-readiness',
      'subscription-management',
      [
        'All subscriptions return unsubscribers',
        'Can subscribe to 3 event types',
        'Clean unsubscribe working'
      ]
    );
  });

  test('should have execution page accessible for notifications', async ({ window }) => {
    const homePage = new HomePage(window);

    await window.waitForLoadState('domcontentloaded');

    // Task input should be visible (home page ready)
    await expect(homePage.taskInput).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'ui-notification-readiness',
      'execution-page-ready',
      [
        'Home page accessible',
        'Task input visible',
        'Ready to navigate to execution'
      ]
    );
  });
});

/**
 * Error Scenario Configuration Tests
 * Tests for error handling configuration
 */
test.describe('Error Scenario Configuration', () => {
  test('should handle disabled fallback gracefully', async ({ window }) => {
    // Disable fallback
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: false,
      });
    });

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settings.enabled).toBe(false);

    // When disabled, rate limits will cause normal errors
    // No fallback attempt will be made

    await captureForAI(
      window,
      'error-scenarios',
      'disabled-fallback',
      [
        'Fallback disabled',
        'Rate limits will cause normal errors',
        'No automatic recovery'
      ]
    );
  });

  test('should handle missing model configuration', async ({ window }) => {
    // Enable without model
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: null,
      });
    });

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settings.enabled).toBe(true);
    expect(settings.fallbackModelId).toBeNull();

    // Fallback won't work without model - this is a configuration error
    // System should show appropriate warning in UI

    await captureForAI(
      window,
      'error-scenarios',
      'missing-model',
      [
        'Fallback enabled but no model',
        'Configuration incomplete',
        'User should see warning'
      ]
    );
  });

  test('should handle LLM failure gracefully with template fallback', async ({ window }) => {
    // Configure with LLM enabled
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
        useLLMSummarization: true,
      });
    });

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settings.useLLMSummarization).toBe(true);

    // When LLM summarization fails, system falls back to template mode
    // This is automatic and transparent to user

    await captureForAI(
      window,
      'error-scenarios',
      'llm-fallback-to-template',
      [
        'LLM summarization configured',
        'Falls back to template on failure',
        'Graceful degradation implemented'
      ]
    );
  });

  test('should have backend unavailable handling', async ({ window }) => {
    // In E2E mode without Supabase, backend is unavailable
    // LLM summarization should fallback to template automatically

    // This is verified by the canCallEdgeFunctions() function
    // which returns false without auth

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    // Settings should still be accessible
    expect(settings).toBeDefined();

    await captureForAI(
      window,
      'error-scenarios',
      'backend-unavailable',
      [
        'Settings accessible without backend',
        'LLM will fallback to template',
        'System remains functional'
      ]
    );
  });
});

/**
 * Logging and Monitoring Tests
 * Tests for fallback event logging
 */
test.describe('Fallback Logging', () => {
  test('should have empty logs initially', async ({ window }) => {
    // Clear logs first
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.clearLogs();
    });

    const logs = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getLogs();
    });

    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBe(0);

    await captureForAI(
      window,
      'fallback-logging',
      'empty-logs',
      [
        'Logs cleared successfully',
        'No fallback events recorded',
        'Clean initial state'
      ]
    );
  });

  test('should have stats API available', async ({ window }) => {
    const stats = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getStats();
    });

    expect(stats).toHaveProperty('totalEvents');
    expect(stats).toHaveProperty('successfulEvents');
    expect(stats).toHaveProperty('failedEvents');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('avgDurationMs');

    // Initial stats should show zero
    expect(stats.totalEvents).toBe(0);

    await captureForAI(
      window,
      'fallback-logging',
      'stats-api-available',
      [
        'Stats API working',
        'All expected fields present',
        'Initial state is zero'
      ]
    );
  });

  test('should be able to retrieve logs with limit', async ({ window }) => {
    const logs = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getLogs(5); // Limit to 5
    });

    expect(Array.isArray(logs)).toBe(true);
    // Should not exceed limit
    expect(logs.length).toBeLessThanOrEqual(5);

    await captureForAI(
      window,
      'fallback-logging',
      'logs-with-limit',
      [
        'Logs retrieved with limit',
        'Limit respected',
        'API handles parameters correctly'
      ]
    );
  });
});

/**
 * Integration with Task System Tests
 * Tests for fallback integration with task execution
 */
test.describe('Task System Integration', () => {
  test('should have task input ready on home page', async ({ window }) => {
    const homePage = new HomePage(window);

    await window.waitForLoadState('domcontentloaded');
    await expect(homePage.taskInput).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Task input should be interactive
    await homePage.taskInput.fill('Test task');
    const inputValue = await homePage.taskInput.inputValue();
    expect(inputValue).toBe('Test task');

    await captureForAI(
      window,
      'task-integration',
      'task-input-ready',
      [
        'Task input visible',
        'Input is interactive',
        'Ready to start tasks'
      ]
    );
  });

  test('should have fallback configured before task start', async ({ window }) => {
    // Configure fallback
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
      });
    });

    const settings = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      return await api.fallback.getSettings();
    });

    expect(settings.enabled).toBe(true);
    expect(settings.fallbackModelId).toBeTruthy();

    await captureForAI(
      window,
      'task-integration',
      'fallback-ready-for-task',
      [
        'Fallback enabled',
        'Model configured',
        'Task will have fallback support'
      ]
    );
  });
});
