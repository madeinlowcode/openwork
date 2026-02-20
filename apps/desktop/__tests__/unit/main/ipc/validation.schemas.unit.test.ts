/**
 * @module __tests__/unit/main/ipc/validation.schemas.unit.test
 * @description Testes unitarios para schemas Zod de validacao IPC.
 * Valida aceitacao de inputs validos e rejeicao de inputs invalidos.
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_PROVIDERS,
  apiKeyStoreSchema,
  apiKeyDeleteSchema,
  apiKeySetSchema,
  apiKeyValidateProviderSchema,
  selectedModelSchema,
  validate,
} from '@main/ipc/validation';

describe('validation schemas', () => {
  describe('ALLOWED_PROVIDERS', () => {
    it('contains core providers: anthropic, openai, google, xai', () => {
      expect(ALLOWED_PROVIDERS).toContain('anthropic');
      expect(ALLOWED_PROVIDERS).toContain('openai');
      expect(ALLOWED_PROVIDERS).toContain('google');
      expect(ALLOWED_PROVIDERS).toContain('xai');
    });

    it('has 15 providers total', () => {
      expect(ALLOWED_PROVIDERS).toHaveLength(15);
    });
  });

  describe('apiKeyStoreSchema', () => {
    it('accepts valid provider + apiKey', () => {
      const result = apiKeyStoreSchema.safeParse({
        provider: 'anthropic',
        apiKey: 'sk-ant-api03-test-key-123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid provider + apiKey + optional label', () => {
      const result = apiKeyStoreSchema.safeParse({
        provider: 'openai',
        apiKey: 'sk-test-key',
        label: 'My key',
      });
      expect(result.success).toBe(true);
    });

    it('rejects unlisted provider', () => {
      const result = apiKeyStoreSchema.safeParse({
        provider: 'not-a-real-provider',
        apiKey: 'some-key',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty apiKey', () => {
      const result = apiKeyStoreSchema.safeParse({
        provider: 'anthropic',
        apiKey: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects apiKey longer than 500 chars', () => {
      const result = apiKeyStoreSchema.safeParse({
        provider: 'anthropic',
        apiKey: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing provider', () => {
      const result = apiKeyStoreSchema.safeParse({
        apiKey: 'some-key',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('apiKeyDeleteSchema', () => {
    it('accepts valid id', () => {
      const result = apiKeyDeleteSchema.safeParse({ id: 'anthropic' });
      expect(result.success).toBe(true);
    });

    it('rejects empty id', () => {
      const result = apiKeyDeleteSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('apiKeySetSchema', () => {
    it('accepts valid key', () => {
      const result = apiKeySetSchema.safeParse({ key: 'sk-test-123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty key', () => {
      const result = apiKeySetSchema.safeParse({ key: '' });
      expect(result.success).toBe(false);
    });

    it('rejects key longer than 500 chars', () => {
      const result = apiKeySetSchema.safeParse({ key: 'k'.repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe('apiKeyValidateProviderSchema', () => {
    it('accepts valid provider + key', () => {
      const result = apiKeyValidateProviderSchema.safeParse({
        provider: 'google',
        key: 'AIzaSy-test-key',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional options object', () => {
      const result = apiKeyValidateProviderSchema.safeParse({
        provider: 'bedrock',
        key: 'aws-key',
        options: { region: 'us-east-1' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid provider', () => {
      const result = apiKeyValidateProviderSchema.safeParse({
        provider: 'invalid',
        key: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('selectedModelSchema', () => {
    it('accepts valid provider + model', () => {
      const result = selectedModelSchema.safeParse({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional baseUrl and deploymentName', () => {
      const result = selectedModelSchema.safeParse({
        provider: 'custom',
        model: 'my-model',
        baseUrl: 'https://my-api.example.com/v1',
        deploymentName: 'prod-v1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty model', () => {
      const result = selectedModelSchema.safeParse({
        provider: 'anthropic',
        model: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty provider', () => {
      const result = selectedModelSchema.safeParse({
        provider: '',
        model: 'claude-3',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid baseUrl', () => {
      const result = selectedModelSchema.safeParse({
        provider: 'custom',
        model: 'test',
        baseUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validate()', () => {
    it('returns parsed data on valid input', () => {
      const data = validate(apiKeySetSchema, { key: 'test-key' });
      expect(data.key).toBe('test-key');
    });

    it('throws Error on invalid input', () => {
      expect(() => validate(apiKeySetSchema, { key: '' })).toThrow('Invalid payload');
    });
  });
});
