/**
 * @module __tests__/unit/main/store/taskHistory.encryption.unit.test
 * @description Testes unitarios para criptografia enc()/dec() no taskHistory.
 * Valida round-trip, fallback para dados nao criptografados, e null handling.
 *
 * AIDEV-NOTE: Mocks de electron, electron-store, better-sqlite3 sao necessarios
 * pois secureStorage depende de electron (app.isPackaged, app.getPath)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

// Mock electron-store with in-memory backing
const mockStoreData: Record<string, unknown> = { values: {} };
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(key: string) {
        return mockStoreData[key];
      }
      set(key: string, value: unknown) {
        mockStoreData[key] = value;
      }
      clear() {
        Object.keys(mockStoreData).forEach((k) => delete mockStoreData[k]);
        mockStoreData.values = {};
      }
    },
  };
});

// Import after mocks
import { encryptValue, decryptValue } from '@main/store/secureStorage';

// Re-create enc/dec locally since they are not exported from taskHistory
function enc(text: string | null | undefined): string | null {
  if (!text) return null;
  return encryptValue(text);
}

function dec(val: string | null | undefined): string | null {
  if (!val) return null;
  return decryptValue(val) ?? val;
}

describe('taskHistory encryption helpers (enc/dec)', () => {
  beforeEach(() => {
    // Reset store data between tests
    Object.keys(mockStoreData).forEach((k) => delete mockStoreData[k]);
    mockStoreData.values = {};
  });

  it('enc() returns null for null input', () => {
    expect(enc(null)).toBeNull();
  });

  it('enc() returns null for undefined input', () => {
    expect(enc(undefined)).toBeNull();
  });

  it('enc() returns null for empty string', () => {
    expect(enc('')).toBeNull();
  });

  it('enc() returns a string different from the input (encrypted)', () => {
    const input = 'dados sensiveis do usuario';
    const encrypted = enc(input);
    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toEqual(input);
    // AES-256-GCM format: iv:authTag:ciphertext (base64)
    expect(encrypted!.split(':')).toHaveLength(3);
  });

  it('dec() returns the original value after enc() (round-trip)', () => {
    const original = 'Texto com acentuação e caracteres especiais: çã@#$%';
    const encrypted = enc(original);
    const decrypted = dec(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('dec() returns original value if decryption fails (fallback)', () => {
    const plainText = 'dados antigos nao criptografados';
    // dec() tries to decrypt, fails, returns val as-is
    const result = dec(plainText);
    expect(result).toEqual(plainText);
  });

  it('dec() returns null for null input', () => {
    expect(dec(null)).toBeNull();
  });

  it('dec() returns null for undefined input', () => {
    expect(dec(undefined)).toBeNull();
  });

  it('round-trip works for long strings', () => {
    const longText = 'A'.repeat(10000);
    const encrypted = enc(longText);
    expect(dec(encrypted)).toEqual(longText);
  });

  it('each enc() call produces different ciphertext (random IV)', () => {
    const input = 'same input';
    const enc1 = enc(input);
    const enc2 = enc(input);
    expect(enc1).not.toEqual(enc2);
    // But both decrypt to the same value
    expect(dec(enc1)).toEqual(input);
    expect(dec(enc2)).toEqual(input);
  });
});
