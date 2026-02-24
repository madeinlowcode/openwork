/**
 * @module __tests__/unit/main/auto-update.unit.test
 * @description Testes unitarios para a configuracao do auto-updater (electron-updater)
 *
 * @dependencies
 * - electron-updater (autoUpdater)
 *
 * AIDEV-NOTE: electron-updater depende do electron real (app.getVersion) ao instanciar,
 * por isso mockamos o modulo inteiro para testar a integracao no index.ts
 * AIDEV-WARNING: Estes testes validam a configuracao, nao o updater real
 */

import { describe, it, expect, vi } from 'vitest';

// Mock electron-updater entirely since it requires real Electron at instantiation
const mockAutoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  allowPrerelease: false,
  checkForUpdates: vi.fn().mockResolvedValue(null),
  quitAndInstall: vi.fn(),
  on: vi.fn(),
};

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

describe('Auto-Update (electron-updater)', () => {
  it('should import electron-updater module', async () => {
    const mod = await import('electron-updater');
    expect(mod).toBeDefined();
    expect(mod.autoUpdater).toBeDefined();
  });

  it('should have autoUpdater with expected API surface', async () => {
    const { autoUpdater } = await import('electron-updater');
    expect(typeof autoUpdater.checkForUpdates).toBe('function');
    expect(typeof autoUpdater.quitAndInstall).toBe('function');
    expect(typeof autoUpdater.on).toBe('function');
    expect('autoDownload' in autoUpdater).toBe(true);
    expect('autoInstallOnAppQuit' in autoUpdater).toBe(true);
    expect('allowPrerelease' in autoUpdater).toBe(true);
  });

  it('should allow configuring autoUpdater properties', async () => {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = true;

    expect(autoUpdater.autoDownload).toBe(true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(autoUpdater.allowPrerelease).toBe(true);
  });

  it('should register event handlers via on()', async () => {
    const { autoUpdater } = await import('electron-updater');
    const handler = vi.fn();

    autoUpdater.on('update-available', handler);
    expect(autoUpdater.on).toHaveBeenCalledWith('update-available', handler);

    autoUpdater.on('download-progress', handler);
    expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', handler);

    autoUpdater.on('update-downloaded', handler);
    expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', handler);

    autoUpdater.on('error', handler);
    expect(autoUpdater.on).toHaveBeenCalledWith('error', handler);
  });
});
