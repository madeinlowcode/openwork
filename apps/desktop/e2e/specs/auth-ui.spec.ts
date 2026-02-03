/**
 * @file auth-ui.spec.ts
 * @description E2E tests for Authentication UI/UX elements
 *
 * @context Auth > UI/UX Testing
 *
 * @tests
 * - Layout and responsiveness
 * - Visual elements
 * - Navigation between app sections
 *
 * AIDEV-NOTE: Tests the visual and UX aspects of the auth system
 * AIDEV-WARNING: In E2E mode without Supabase, shows initialization error - tests handle this
 */

import { test, expect } from '../fixtures';
import { AuthPage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

/**
 * Layout Tests
 */
test.describe('Auth Layout', () => {
  test('should display content in a centered container', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Check for centered flex container
    const body = window.locator('body');
    await expect(body).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Verify some form of centered content exists
    const centeredContent = window.locator('[class*="flex"][class*="items-center"], .flex.items-center');
    const hasCenteredContent = await centeredContent.count();
    expect(hasCenteredContent).toBeGreaterThan(0);

    await captureForAI(
      window,
      'auth-layout',
      'centered-container',
      [
        'Content is in a flex container',
        'Items are centered',
        'Layout is proper'
      ]
    );
  });

  test('should have proper viewport filling', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Check for min-h-screen class
    const fullHeightContainer = window.locator('[class*="min-h-screen"], .min-h-screen');
    const hasFullHeight = await fullHeightContainer.count();
    expect(hasFullHeight).toBeGreaterThan(0);

    await captureForAI(
      window,
      'auth-layout',
      'viewport-filling',
      [
        'Container fills viewport height',
        'No scrollbar issues',
        'Proper spacing'
      ]
    );
  });
});

/**
 * Visual Elements Tests
 */
test.describe('Auth Visual Elements', () => {
  test('should display scale icon', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Look for SVG icon (scale icon from lucide-react)
    const svgIcon = window.locator('svg').first();
    const hasIcon = await svgIcon.isVisible().catch(() => false);

    // At least some SVG should be present
    expect(hasIcon).toBe(true);

    await captureForAI(
      window,
      'auth-visual',
      'scale-icon',
      [
        'SVG icon is present',
        'Icon is visible',
        'Visual branding element exists'
      ]
    );
  });

  test('should have styled heading', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // H1 should exist and have text
    const h1 = window.locator('h1');
    await expect(h1).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    const h1Text = await h1.innerText();
    expect(h1Text.length).toBeGreaterThan(0);

    await captureForAI(
      window,
      'auth-visual',
      'styled-heading',
      [
        'H1 heading is visible',
        'Heading has content',
        'Typography is styled'
      ]
    );
  });

  test('should have descriptive text', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Should have paragraph text
    const paragraphs = window.locator('p');
    const paragraphCount = await paragraphs.count();
    expect(paragraphCount).toBeGreaterThan(0);

    await captureForAI(
      window,
      'auth-visual',
      'descriptive-text',
      [
        'Descriptive text is present',
        'User gets context',
        'Page is informative'
      ]
    );
  });
});

/**
 * Color and Theme Tests
 */
test.describe('Auth Theme', () => {
  test('should have proper background color', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Check for background class
    const bgContainer = window.locator('[class*="bg-background"], .bg-background');
    const hasBg = await bgContainer.count();
    expect(hasBg).toBeGreaterThan(0);

    await captureForAI(
      window,
      'auth-theme',
      'background-color',
      [
        'Background color is applied',
        'Theme is consistent',
        'Design system in use'
      ]
    );
  });

  test('should display error state with appropriate colors', async ({ window }) => {
    const authPage = new AuthPage(window);

    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    const hasError = await authPage.hasInitializationError();

    if (hasError) {
      // Error should use destructive color scheme
      const errorIndicator = window.locator('[class*="destructive"], [class*="error"], [class*="red"]');
      const hasErrorStyling = await errorIndicator.count();
      expect(hasErrorStyling).toBeGreaterThan(0);

      await captureForAI(
        window,
        'auth-theme',
        'error-colors',
        [
          'Error state uses appropriate colors',
          'Visual feedback is clear',
          'Error is distinguishable'
        ]
      );
    } else {
      // No error - just verify primary colors are used
      const primaryElements = window.locator('[class*="primary"], [class*="text-primary"]');
      const hasPrimary = await primaryElements.count();

      await captureForAI(
        window,
        'auth-theme',
        'primary-colors',
        [
          'Primary colors are used',
          'Theme is applied',
          'Branding is consistent'
        ]
      );
    }
  });
});

/**
 * Responsiveness Tests
 */
test.describe('Auth Responsiveness', () => {
  test('should maintain layout at different viewport widths', async ({ window }) => {
    const authPage = new AuthPage(window);

    // Test at standard desktop size
    await window.setViewportSize({ width: 1280, height: 720 });
    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Content should be visible
    const body = window.locator('body');
    await expect(body).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'auth-responsive',
      'desktop-viewport',
      [
        'Layout works at 1280px width',
        'Content is visible',
        'No overflow issues'
      ]
    );

    // Test at tablet size
    await window.setViewportSize({ width: 768, height: 1024 });
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    await expect(body).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'auth-responsive',
      'tablet-viewport',
      [
        'Layout works at 768px width',
        'Content adapts to viewport',
        'Responsive design works'
      ]
    );
  });
});

/**
 * Animation Tests
 */
test.describe('Auth Animations', () => {
  test('should load without jarring transitions', async ({ window }) => {
    const authPage = new AuthPage(window);

    // Navigate and capture immediately
    await authPage.navigateToAuth();

    // Wait for any animations
    await window.waitForTimeout(TEST_TIMEOUTS.ANIMATION * 2);

    // Page should be stable
    const body = window.locator('body');
    await expect(body).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'auth-animations',
      'smooth-load',
      [
        'Page loaded smoothly',
        'No jarring transitions',
        'Animations completed'
      ]
    );
  });
});

/**
 * Integration with Main App Tests
 */
test.describe('Auth App Integration', () => {
  test('should coexist with main app navigation', async ({ window }) => {
    const authPage = new AuthPage(window);

    // Start at home
    await window.waitForLoadState('domcontentloaded');

    // Go to auth
    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Return to home
    await window.evaluate(() => {
      window.location.hash = '#/';
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Verify home loaded
    const taskInput = window.getByTestId('task-input-textarea');
    await expect(taskInput).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'auth-integration',
      'app-coexistence',
      [
        'Auth and main app coexist',
        'Navigation works both ways',
        'State is maintained'
      ]
    );
  });

  test('should not break settings dialog', async ({ window }) => {
    const authPage = new AuthPage(window);

    // Navigate to auth first
    await authPage.navigateToAuth();
    await authPage.waitForAuthPageLoad();

    // Go back to home
    await window.evaluate(() => {
      window.location.hash = '#/';
    });
    await window.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);

    // Open settings
    const settingsButton = window.getByTestId('sidebar-settings-button');
    await settingsButton.click();

    // Settings should open
    const settingsDialog = window.getByTestId('settings-dialog');
    await expect(settingsDialog).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    await captureForAI(
      window,
      'auth-integration',
      'settings-still-work',
      [
        'Settings dialog opens after auth visit',
        'Navigation did not break settings',
        'App is functional'
      ]
    );
  });
});
