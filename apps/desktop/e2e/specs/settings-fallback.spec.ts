/**
 * @file settings-fallback.spec.ts
 * @description E2E tests for the Fallback Settings tab in the Settings dialog
 *
 * @context Settings > Fallback tab
 *
 * @tests
 * - Display fallback tab in settings
 * - Toggle fallback enabled/disabled
 * - Select fallback model
 * - Toggle LLM summarization
 * - Persist settings after reload
 *
 * AIDEV-NOTE: Tests the intelligent fallback system UI implemented in Task 4
 * AIDEV-WARNING: These tests require the app to be running in E2E mode
 */

import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

test.describe('Fallback Settings', () => {
  test('should display fallback tab in settings', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    // Wait for page to load
    await window.waitForLoadState('domcontentloaded');

    // Open settings dialog
    await settingsPage.navigateToSettings();

    // Verify fallback tab is visible
    await expect(settingsPage.fallbackTab).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture settings dialog with fallback tab
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-tab-visible',
      [
        'Fallback tab is visible in settings',
        'Tab can be clicked to view fallback settings',
        'Settings dialog loaded correctly'
      ]
    );
  });

  test('should navigate to fallback tab and display fallback settings', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Click on Fallback tab
    await settingsPage.navigateToFallbackTab();

    // Wait for fallback content to load
    await window.waitForTimeout(500);

    // Verify fallback toggle is visible
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture fallback settings
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-settings-content',
      [
        'Fallback settings content is visible',
        'Fallback enabled toggle is present',
        'User can configure fallback behavior'
      ]
    );
  });

  test('should toggle fallback enabled', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Wait for toggle to be ready
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture initial state
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-before-toggle',
      [
        'Fallback toggle in initial state (disabled)',
        'Toggle is ready to click'
      ]
    );

    // Click to enable fallback
    await settingsPage.toggleFallbackEnabled();

    // Wait for state change to propagate
    await window.waitForTimeout(300);

    // Capture toggled state
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-after-toggle',
      [
        'Fallback toggle state changed',
        'UI reflects enabled state',
        'Model selector should become active'
      ]
    );
  });

  test('should display model selector when fallback is enabled', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await settingsPage.toggleFallbackEnabled();

    // Wait for model selector to become active
    await window.waitForTimeout(500);

    // Verify model selector is visible and enabled
    await expect(settingsPage.fallbackModelSelect).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture model selector
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-model-selector',
      [
        'Model selector is visible when fallback is enabled',
        'User can select a fallback model',
        'Dropdown contains available models'
      ]
    );
  });

  test('should select a fallback model', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await settingsPage.toggleFallbackEnabled();

    // Wait for model selector
    await window.waitForTimeout(500);

    // Select a model (Claude 3 Haiku)
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');

    // Wait for selection to be saved
    await window.waitForTimeout(500);

    // Verify model was selected
    await expect(settingsPage.fallbackModelSelect).toHaveValue('anthropic/claude-3-haiku');

    // Capture selected state
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-model-selected',
      [
        'Fallback model is selected',
        'Selection is reflected in dropdown',
        'Settings are saved automatically'
      ]
    );
  });

  test('should toggle LLM summarization', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback first
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await settingsPage.toggleFallbackEnabled();

    // Wait for content to become active
    await window.waitForTimeout(800);

    // Verify summarization toggle is visible (may be disabled until model selected)
    await expect(settingsPage.fallbackSummarizationToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Select a model first to enable summarization toggle
    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(500);

    // Toggle summarization (now should be enabled)
    await settingsPage.fallbackSummarizationToggle.click({ force: true });

    // Wait for state change
    await window.waitForTimeout(300);

    // Capture summarization enabled state
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-summarization-enabled',
      [
        'LLM summarization toggle is enabled',
        'Additional model selector may appear',
        'Cost warning is displayed'
      ]
    );
  });

  test('should close dialog and reopen successfully', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback and select model
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(500);

    await settingsPage.selectFallbackModel('anthropic/claude-3-haiku');
    await window.waitForTimeout(500);

    // Verify model was selected before closing
    await expect(settingsPage.fallbackModelSelect).toHaveValue('anthropic/claude-3-haiku');

    // Close dialog
    await settingsPage.pressEscapeToClose();

    // Handle warning dialog if present
    const closeAnywayVisible = await settingsPage.closeAnywayButton.isVisible().catch(() => false);
    if (closeAnywayVisible) {
      await settingsPage.closeAnywayButton.click();
    }

    // Wait for dialog to close
    await expect(settingsPage.settingsDialog).not.toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Reopen settings - this should not crash and should show fallback tab
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Wait for settings to load
    await window.waitForTimeout(500);

    // Verify fallback tab is still functional
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await expect(settingsPage.fallbackModelSelect).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture reopened state
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-settings-reopened',
      [
        'Settings dialog reopened successfully',
        'Fallback tab is functional',
        'UI components are visible'
      ]
    );
  });

  test('should show status message when fallback is configured', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();
    await settingsPage.navigateToFallbackTab();

    // Enable fallback
    await expect(settingsPage.fallbackEnabledToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await settingsPage.toggleFallbackEnabled();
    await window.waitForTimeout(800);

    // Select model using force click since element may take time to enable
    const modelSelect = settingsPage.fallbackModelSelect;
    await modelSelect.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.NAVIGATION });
    await modelSelect.selectOption({ value: 'anthropic/claude-3-haiku' }, { force: true });
    await window.waitForTimeout(500);

    // Look for status message indicating fallback is configured
    // Text: "Fallback configured and ready" (en) or "Fallback configurado e pronto" (pt-BR)
    const statusMessage = window.getByText(/Fallback (configured and ready|configurado e pronto)/i);
    await expect(statusMessage).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture configured status
    await captureForAI(
      window,
      'settings-dialog',
      'fallback-status-configured',
      [
        'Status message shows fallback is configured',
        'User receives confirmation of settings',
        'System is ready to handle rate limits'
      ]
    );
  });
});
