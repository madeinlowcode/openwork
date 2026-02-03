/**
 * @file electron-auth.ts
 * @description Custom fixtures for Auth E2E testing in Electron.
 *
 * This fixture is different from the main electron-app fixture because:
 * 1. Auth page doesn't have the task-input-textarea element
 * 2. We need to navigate to /auth after app loads
 *
 * AIDEV-NOTE: Use this fixture for auth-related tests
 * AIDEV-WARNING: This fixture navigates away from home page
 */

import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { TEST_TIMEOUTS } from '../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Custom fixtures for Electron Auth E2E testing.
 */
type ElectronAuthFixtures = {
  /** The Electron application instance */
  electronApp: ElectronApplication;
  /** The main renderer window (not DevTools) */
  window: Page;
};

/**
 * Extended Playwright test with Electron fixtures for Auth testing.
 * Navigates to auth page after app loads.
 */
export const test = base.extend<ElectronAuthFixtures>({
  electronApp: async ({}, use) => {
    const mainPath = resolve(__dirname, '../../dist-electron/main/index.js');

    const app = await electron.launch({
      args: [
        mainPath,
        '--e2e-skip-auth',
        '--e2e-mock-tasks',
        // Disable sandbox in Docker (required for containerized Electron)
        ...(process.env.DOCKER_ENV === '1' ? ['--no-sandbox', '--disable-gpu'] : []),
      ],
      env: {
        ...process.env,
        E2E_SKIP_AUTH: '1',
        E2E_MOCK_TASK_EVENTS: '1',
        NODE_ENV: 'test',
      },
    });

    await use(app);

    // Close app and wait for single-instance lock release
    await app.close();
    await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.APP_RESTART));
  },

  window: async ({ electronApp }, use) => {
    // Get the first window - DevTools is disabled in E2E mode
    const window = await electronApp.firstWindow();

    // Wait for page to be fully loaded
    await window.waitForLoadState('load');

    // Wait for initial React hydration by checking for any visible element
    // Auth page has different elements than Home page
    await window.waitForSelector('body', {
      state: 'visible',
      timeout: TEST_TIMEOUTS.NAVIGATION,
    });

    // Wait a bit for React to mount
    await window.waitForTimeout(TEST_TIMEOUTS.HYDRATION);

    await use(window);
  },
});

export { expect } from '@playwright/test';
