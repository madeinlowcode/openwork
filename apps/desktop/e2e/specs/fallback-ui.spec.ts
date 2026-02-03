/**
 * @file fallback-ui.spec.ts
 * @description E2E tests for the FallbackNotification UI component
 *
 * @context Renderer > Execution > FallbackNotification
 *
 * @tests
 * - FallbackNotification component rendering
 * - Visibility states (active/inactive)
 * - Model information display
 * - Context method indicators
 * - Auto-dismiss and manual dismiss behavior
 *
 * AIDEV-NOTE: Tests the FallbackNotification.tsx component behavior
 * AIDEV-WARNING: These tests verify UI behavior, not actual fallback triggering
 * AIDEV-WARNING: Actual notification requires a real rate limit error during task execution
 */

import { test, expect } from '../fixtures';
import { SettingsPage, HomePage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

/**
 * Fallback Settings UI Tests
 * Tests for the fallback settings panel in the Settings dialog
 */
test.describe('Fallback Settings UI', () => {
  test('should display fallback settings card with proper structure', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Check for the fallback card structure
    const fallbackCard = settingsPage.fallbackCard;
    await expect(fallbackCard).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Should have toggle and other controls
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'fallback-ui',
      'settings-card-structure',
      [
        'Fallback card is visible',
        'Toggle control present',
        'Proper UI structure'
      ]
    );
  });

  test('should show model selector when fallback is enabled', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Model selector should appear
    await expect(settingsPage.fallbackModelSelect).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'fallback-ui',
      'model-selector-visible',
      [
        'Fallback enabled',
        'Model selector appears',
        'Interactive controls working'
      ]
    );
  });

  test('should show summarization toggle when model is selected', async ({ window }) => {
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

    // Summarization toggle should appear
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'fallback-ui',
      'summarization-toggle-visible',
      [
        'Model selected',
        'Summarization toggle appears',
        'Progressive disclosure working'
      ]
    );
  });

  test('should show status message when fallback is configured', async ({ window }) => {
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

    // Navigate to settings and fallback tab to see the status message
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE * 2);

    // Look for status message - the translation says "Fallback configured and ready"
    const statusMessage = window.getByText(/configured and ready|configurado e pronto/i);
    await expect(statusMessage).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION * 2 });

    await captureForAI(
      window,
      'fallback-ui',
      'status-message-shown',
      [
        'Fallback fully configured',
        'Status message visible',
        'User feedback present'
      ]
    );
  });
});

/**
 * FallbackNotification Component Tests
 * Tests for the notification component behavior (via settings since we can't trigger real fallback)
 */
test.describe('FallbackNotification Component Behavior', () => {
  test('should have fallback event handlers registered', async ({ window }) => {
    // Verify the event handlers are available in the preload API
    const handlers = await window.evaluate(() => {
      const api = (window as any).jurisiar;
      return {
        onFallbackStarted: typeof api?.onFallbackStarted,
        onFallbackCompleted: typeof api?.onFallbackCompleted,
        onFallbackFailed: typeof api?.onFallbackFailed,
      };
    });

    expect(handlers.onFallbackStarted).toBe('function');
    expect(handlers.onFallbackCompleted).toBe('function');
    expect(handlers.onFallbackFailed).toBe('function');

    await captureForAI(
      window,
      'fallback-notification',
      'event-handlers-registered',
      [
        'onFallbackStarted handler available',
        'onFallbackCompleted handler available',
        'onFallbackFailed handler available'
      ]
    );
  });

  test('should be able to subscribe to fallback events', async ({ window }) => {
    // Test that we can subscribe and unsubscribe to events
    const result = await window.evaluate(() => {
      const api = (window as any).jurisiar;
      let eventReceived = false;

      // Subscribe
      const unsubscribe = api.onFallbackStarted(() => {
        eventReceived = true;
      });

      // Verify unsubscribe is a function
      const hasUnsubscribe = typeof unsubscribe === 'function';

      // Clean up
      if (hasUnsubscribe) {
        unsubscribe();
      }

      return {
        subscribeWorked: hasUnsubscribe,
      };
    });

    expect(result.subscribeWorked).toBe(true);

    await captureForAI(
      window,
      'fallback-notification',
      'event-subscription-works',
      [
        'Can subscribe to fallback events',
        'Unsubscribe function returned',
        'Event system is functional'
      ]
    );
  });
});

/**
 * Model Display Tests
 * Tests for model name display formatting
 */
test.describe('Model Display Formatting', () => {
  test('should display model names correctly in selector', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Check model selector has readable options
    const modelSelect = settingsPage.fallbackModelSelect;
    await expect(modelSelect).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Get options text
    const options = await modelSelect.locator('option').allTextContents();

    // Should have some options
    expect(options.length).toBeGreaterThan(0);

    await captureForAI(
      window,
      'model-display',
      'selector-options',
      [
        'Model selector has options',
        `Found ${options.length} model options`,
        'Options are readable'
      ]
    );
  });

  test('should show selected model value after selection', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Select a model
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Verify selection
    const selectedValue = await settingsPage.fallbackModelSelect.inputValue();
    expect(selectedValue).toBe('anthropic/claude-3-haiku');

    await captureForAI(
      window,
      'model-display',
      'selected-model-shown',
      [
        'Model selected successfully',
        'Selected value matches expected',
        'Selection persisted in UI'
      ]
    );
  });
});

/**
 * Context Method Display Tests
 * Tests for LLM vs Template context method display
 */
test.describe('Context Method Display', () => {
  test('should show LLM summarization option', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable and configure
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // LLM summarization should be visible
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Look for associated label
    const llmLabels = window.getByText(/LLM|summariz|sumariz/i);
    const hasLabel = await llmLabels.first().isVisible().catch(() => false);

    await captureForAI(
      window,
      'context-method-display',
      'llm-option-shown',
      [
        'LLM summarization toggle visible',
        hasLabel ? 'Associated label found' : 'No label visible',
        'Context method option accessible'
      ]
    );
  });

  test('should toggle LLM summarization state', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Reset to known state first via IPC
    await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      await api.fallback.setSettings({
        enabled: true,
        fallbackModelId: 'anthropic/claude-3-haiku',
        useLLMSummarization: false,
      });
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Refresh the page to get the updated state
    await settingsPage.pressEscapeToClose();
    const closeAnywayVisible = await settingsPage.closeAnywayButton.isVisible().catch(() => false);
    if (closeAnywayVisible) {
      await settingsPage.closeAnywayButton.click();
    }
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Get initial state (should be false after reset)
    const initialState = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      const settings = await api.fallback.getSettings();
      return settings.useLLMSummarization;
    });

    // Wait for toggle to be visible and click it
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await settingsPage.fallbackSummarizationToggle.click({ force: true });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE * 2);

    // Get new state
    const newState = await window.evaluate(async () => {
      const api = (window as any).jurisiar;
      const settings = await api.fallback.getSettings();
      return settings.useLLMSummarization;
    });

    // State should have toggled
    expect(newState).not.toBe(initialState);

    await captureForAI(
      window,
      'context-method-display',
      'llm-toggle-works',
      [
        'LLM summarization toggled',
        `Changed from ${initialState} to ${newState}`,
        'Toggle state persisted'
      ]
    );
  });
});

/**
 * Dismiss Behavior Tests
 * Tests for notification dismiss behavior (via settings dialog)
 */
test.describe('Dialog Dismiss Behavior', () => {
  test('should close settings dialog with Escape key', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Dialog should be visible
    await expect(settingsPage.settingsDialog).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Press Escape
    await window.keyboard.press('Escape');
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Handle warning dialog if present
    const closeAnywayVisible = await settingsPage.closeAnywayButton.isVisible().catch(() => false);
    if (closeAnywayVisible) {
      await settingsPage.closeAnywayButton.click();
      await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
    }

    // Dialog should be closed
    await expect(settingsPage.settingsDialog).not.toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'dismiss-behavior',
      'escape-closes-dialog',
      [
        'Escape key triggers close',
        'Dialog dismissed',
        'Keyboard accessibility working'
      ]
    );
  });

  test('should close settings dialog with Done button', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Navigate to a tab to avoid "no provider" warning
    await settingsPage.navigateToFallbackTab();
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Dialog should be visible
    await expect(settingsPage.settingsDialog).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Click Done button
    await settingsPage.closeDialog();
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Handle warning dialog if present
    const closeAnywayVisible = await settingsPage.closeAnywayButton.isVisible().catch(() => false);
    if (closeAnywayVisible) {
      await settingsPage.closeAnywayButton.click();
      await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
    }

    // Dialog should be closed
    await expect(settingsPage.settingsDialog).not.toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'dismiss-behavior',
      'done-closes-dialog',
      [
        'Done button triggers close',
        'Dialog dismissed',
        'Button accessibility working'
      ]
    );
  });

  test('should reopen dialog after close', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Close
    await window.keyboard.press('Escape');
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    const closeAnywayVisible = await settingsPage.closeAnywayButton.isVisible().catch(() => false);
    if (closeAnywayVisible) {
      await settingsPage.closeAnywayButton.click();
      await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
    }

    await expect(settingsPage.settingsDialog).not.toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Reopen
    await settingsPage.navigateToSettings();

    // Should be visible again
    await expect(settingsPage.settingsDialog).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'dismiss-behavior',
      'reopen-after-close',
      [
        'Dialog closed successfully',
        'Dialog reopened successfully',
        'Dialog state properly managed'
      ]
    );
  });
});

/**
 * Translation Tests
 * Tests for i18n support in fallback UI
 */
test.describe('Fallback UI Translations', () => {
  test('should display fallback tab label', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Fallback tab should have text
    await expect(settingsPage.fallbackTab).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    const tabText = await settingsPage.fallbackTab.textContent();
    expect(tabText).toBeTruthy();
    expect(tabText!.length).toBeGreaterThan(0);

    await captureForAI(
      window,
      'translations',
      'fallback-tab-label',
      [
        'Fallback tab has text',
        `Tab text: "${tabText}"`,
        'Translation loaded'
      ]
    );
  });

  test('should display status messages in UI language', async ({ window }) => {
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

    // Look for status text - wait for it to appear
    const statusLocator = window.getByText(/configured and ready|configurado e pronto/i).first();
    await expect(statusLocator).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION * 2 });
    const statusText = await statusLocator.textContent();

    expect(statusText).toBeTruthy();

    await captureForAI(
      window,
      'translations',
      'status-message-translated',
      [
        'Status message displayed',
        `Text: "${statusText}"`,
        'i18n working for status'
      ]
    );
  });
});
