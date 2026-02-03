/**
 * Navigation utilities for Electron E2E tests.
 * Handles hash-based routing in Electron apps.
 */
import type { Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../config';

/**
 * Navigate to a hash route in the Electron app.
 *
 * In Electron, we can't use page.goto() with hash routes directly,
 * so we need to use evaluate() to change the hash.
 *
 * @param page - Playwright page object
 * @param hash - Hash route to navigate to (e.g., '#/auth', '#/')
 * @returns Promise that resolves when navigation is complete
 *
 * @example
 * await navigateToHash(window, '#/auth');
 * await navigateToHash(window, '#/');
 */
export async function navigateToHash(page: Page, hash: string): Promise<void> {
  // Ensure hash starts with #
  const normalizedHash = hash.startsWith('#') ? hash : `#${hash}`;

  await page.evaluate((targetHash) => {
    window.location.hash = targetHash;
  }, normalizedHash);

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
}

/**
 * Navigate to the home page.
 *
 * @param page - Playwright page object
 */
export async function navigateToHome(page: Page): Promise<void> {
  await navigateToHash(page, '#/');
}

/**
 * Navigate to the auth page.
 *
 * @param page - Playwright page object
 */
export async function navigateToAuthPage(page: Page): Promise<void> {
  await navigateToHash(page, '#/auth');
}
