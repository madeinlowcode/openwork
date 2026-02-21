import Store from 'electron-store';
import { app } from 'electron';
import * as crypto from 'crypto';
import * as os from 'os';

/**
 * Secure storage using electron-store with custom AES-256-GCM encryption.
 *
 * This implementation derives an encryption key from machine-specific values
 * (hostname, platform, user home directory, app path) to avoid macOS Keychain
 * prompts while still providing reasonable security for API keys.
 *
 * Security considerations:
 * - Keys are encrypted at rest using AES-256-GCM
 * - Encryption key is derived from machine-specific data (not stored)
 * - Less secure than Keychain (key derivation could be reverse-engineered)
 * - Suitable for API keys that can be rotated if compromised
 */

// Use different store names for dev vs production to avoid conflicts
const getStoreName = () => (app.isPackaged ? 'secure-storage' : 'secure-storage-dev');

interface SecureStorageSchema {
  /** Encrypted values stored as base64 strings (format: iv:authTag:ciphertext) */
  values: Record<string, string>;
  /** Salt for key derivation (generated once per installation) */
  salt?: string;
}

// Lazy initialization to ensure app is ready
let _secureStore: Store<SecureStorageSchema> | null = null;
let _derivedKey: Buffer | null = null;

function getSecureStore(): Store<SecureStorageSchema> {
  if (!_secureStore) {
    _secureStore = new Store<SecureStorageSchema>({
      name: getStoreName(),
      defaults: { values: {} },
    });
  }
  return _secureStore;
}

/**
 * Get or create a salt for key derivation.
 * The salt is stored in the config file and generated once per installation.
 */
function getSalt(): Buffer {
  const store = getSecureStore();
  let saltBase64 = store.get('salt');

  if (!saltBase64) {
    // Generate a new random salt
    const salt = crypto.randomBytes(32);
    saltBase64 = salt.toString('base64');
    store.set('salt', saltBase64);
  }

  return Buffer.from(saltBase64, 'base64');
}

const INSTALL_ID_RAW_KEY = '__install_id__';

// AIDEV-NOTE: ID gerado 1x por instalacao, armazenado sem criptografia
// pois ele E PARTE da chave de derivacao (nao pode ser criptografado com a propria chave)
// AIDEV-SECURITY: Este UUID torna a chave derivada unica por instalacao,
// impedindo que copiar secure-storage.json para outra maquina permita decriptar
function getInstallationId(): string {
  const store = getSecureStore();
  const values = store.get('values');
  if (values[INSTALL_ID_RAW_KEY]) {
    return values[INSTALL_ID_RAW_KEY];
  }
  const id = crypto.randomBytes(16).toString('hex');
  store.set('values', { ...values, [INSTALL_ID_RAW_KEY]: id });
  return id;
}

/**
 * Derive an encryption key from machine-specific data.
 * This is deterministic for the same machine/installation.
 *
 * Note: We avoid hostname as it can be changed by users (renaming laptop).
 *
 * AIDEV-WARNING: Alterar os fatores do machineData invalida TODAS as chaves existentes.
 * Dados criptografados com a chave anterior nao serao decriptaveis.
 */
function getDerivedKey(): Buffer {
  if (_derivedKey) {
    return _derivedKey;
  }

  // Combine machine-specific values to create a unique identifier
  // Note: We intentionally exclude userData path so encryption keys remain stable
  // across userData directory version changes (e.g., desktop -> desktop-v2 -> Jurisiar)
  const machineData = [
    os.platform(),
    os.homedir(),
    os.userInfo().username,
    'com.jurisiar.app', // App identifier
    app.getPath('userData'), // path unico por OS user + instalacao
    getInstallationId(), // UUID aleatorio gerado na 1a execucao
  ].join(':');

  const salt = getSalt();

  // Use PBKDF2 to derive a 256-bit key
  _derivedKey = crypto.pbkdf2Sync(
    machineData,
    salt,
    100000, // iterations
    32, // key length (256 bits)
    'sha256'
  );

  return _derivedKey;
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptValue(value: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12); // GCM recommended IV size

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a value encrypted with encryptValue.
 */
export function decryptValue(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // Invalid format
      return null;
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // Decryption failed (wrong key, corrupted data, etc.)
    // Don't log error details to avoid leaking sensitive context
    return null;
  }
}

/**
 * Store an API key securely
 */
export function storeApiKey(provider: string, apiKey: string): void {
  const store = getSecureStore();
  const encrypted = encryptValue(apiKey);
  const values = store.get('values');
  values[`apiKey:${provider}`] = encrypted;
  store.set('values', values);
}

/**
 * Retrieve an API key
 */
export function getApiKey(provider: string): string | null {
  const store = getSecureStore();
  const values = store.get('values');
  if (!values) {
    return null;
  }
  const encrypted = values[`apiKey:${provider}`];
  if (!encrypted) {
    return null;
  }
  return decryptValue(encrypted);
}

/**
 * Delete an API key
 */
export function deleteApiKey(provider: string): boolean {
  const store = getSecureStore();
  const values = store.get('values');
  const key = `apiKey:${provider}`;
  if (!(key in values)) {
    return false;
  }
  delete values[key];
  store.set('values', values);
  return true;
}

/**
 * Supported API key providers
 */
export type ApiKeyProvider = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'xai' | 'deepseek' | 'moonshot' | 'zai' | 'custom' | 'bedrock' | 'litellm' | 'minimax' | 'datajud' | 'escavador';

/**
 * Get all API keys for all providers
 */
export async function getAllApiKeys(): Promise<Record<ApiKeyProvider, string | null>> {
  const [anthropic, openai, openrouter, google, xai, deepseek, moonshot, zai, custom, bedrock, litellm, minimax, datajud, escavador] = await Promise.all([
    getApiKey('anthropic'),
    getApiKey('openai'),
    getApiKey('openrouter'),
    getApiKey('google'),
    getApiKey('xai'),
    getApiKey('deepseek'),
    getApiKey('moonshot'),
    getApiKey('zai'),
    getApiKey('custom'),
    getApiKey('bedrock'),
    getApiKey('litellm'),
    getApiKey('minimax'),
    getApiKey('datajud'),
    getApiKey('escavador'),
  ]);

  return { anthropic, openai, openrouter, google, xai, deepseek, moonshot, zai, custom, bedrock, litellm, minimax, datajud, escavador };
}

/**
 * Store Bedrock credentials (JSON stringified)
 */
export function storeBedrockCredentials(credentials: string): void {
  storeApiKey('bedrock', credentials);
}

/**
 * Get Bedrock credentials (returns parsed object or null)
 */
export function getBedrockCredentials(): Record<string, string> | null {
  const stored = getApiKey('bedrock');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Check if any API key is stored
 */
export async function hasAnyApiKey(): Promise<boolean> {
  const keys = await getAllApiKeys();
  return Object.values(keys).some((k) => k !== null);
}

/**
 * List all stored credential keys for this service
 * 🔒 AIDEV-SECURITY: Retorna apenas nomes de chaves, NÃO valores descriptografados
 * (VULN-008 - anterior retornava senhas em texto plano)
 *
 * @returns Array de nomes de chaves armazenadas (ex: "apiKey:anthropic")
 */
export function listStoredCredentials(): string[] {
  const store = getSecureStore();
  const values = store.get('values');
  return Object.keys(values);
}

/**
 * Verifica se uma credencial específica existe (sem expor o valor)
 *
 * @param account - Nome da conta/chave a verificar
 * @returns true se a credencial existe
 */
export function hasCredential(account: string): boolean {
  const store = getSecureStore();
  const values = store.get('values');
  return account in values;
}

/**
 * Clear all secure storage (used during fresh install cleanup)
 */
export function clearSecureStorage(): void {
  const store = getSecureStore();
  store.clear();
  _derivedKey = null; // Clear cached key
}

// ============================================================================
// Auth Token Storage
// ============================================================================
// AIDEV-NOTE: Metodos para armazenar/recuperar tokens JWT de autenticacao Supabase
// AIDEV-WARNING: Tokens sao armazenados de forma segura via AES-256-GCM
// AIDEV-SECURITY: Tokens JWT podem conter informacoes sensiveis - nunca logar

/**
 * Interface para token de autenticacao armazenado
 */
export interface StoredAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

const AUTH_TOKEN_KEY = 'authToken:supabase';

/**
 * Armazena token de autenticacao de forma segura
 *
 * @param token - Token de autenticacao a ser armazenado
 *
 * AIDEV-WARNING: O token e serializado para JSON antes de criptografar
 * AIDEV-SECURITY: Nunca logar o conteudo do token
 */
export function storeAuthToken(token: StoredAuthToken): void {
  const store = getSecureStore();
  const serialized = JSON.stringify(token);
  const encrypted = encryptValue(serialized);
  const values = store.get('values');
  values[AUTH_TOKEN_KEY] = encrypted;
  store.set('values', values);
}

/**
 * Recupera token de autenticacao armazenado
 *
 * @returns Token armazenado ou null se nao existir
 *
 * AIDEV-NOTE: Retorna null se token nao existir ou for invalido
 */
export function getAuthToken(): StoredAuthToken | null {
  const store = getSecureStore();
  const values = store.get('values');
  if (!values) {
    return null;
  }
  const encrypted = values[AUTH_TOKEN_KEY];
  if (!encrypted) {
    return null;
  }
  const decrypted = decryptValue(encrypted);
  if (!decrypted) {
    return null;
  }
  try {
    return JSON.parse(decrypted) as StoredAuthToken;
  } catch {
    return null;
  }
}

/**
 * Remove token de autenticacao armazenado (logout)
 *
 * @returns true se token foi removido, false se nao existia
 */
export function clearAuthToken(): boolean {
  const store = getSecureStore();
  const values = store.get('values');
  if (!(AUTH_TOKEN_KEY in values)) {
    return false;
  }
  delete values[AUTH_TOKEN_KEY];
  store.set('values', values);
  return true;
}

/**
 * Verifica se existe token de autenticacao armazenado
 *
 * @returns true se existe token armazenado
 */
export function hasAuthToken(): boolean {
  const store = getSecureStore();
  const values = store.get('values');
  return AUTH_TOKEN_KEY in values;
}

// =============================================================================
// DataJud API Key Storage
// =============================================================================
// AIDEV-NOTE: Metodos para armazenar/recuperar chave da API DataJud (CNJ)
// AIDEV-WARNING: A chave da API DataJud e armazenada de forma segura via AES-256-GCM

// AIDEV-WARNING: NÃO adicionar 'apiKey:' aqui - storeApiKey já adiciona o prefixo
// Bug anterior: 'apiKey:datajud' + storeApiKey() = 'apiKey:apiKey:datajud'
const DATAJUD_API_KEY = 'datajud';

/**
 * Armazena a chave da API DataJud de forma segura
 *
 * @param apiKey - Chave da API DataJud a ser armazenada
 *
 * 🔒 AIDEV-SECURITY: A chave e criptografada antes de ser armazenada
 * ⚠️ AIDEV-NOTE: Validar a chave com a API antes de armazenar
 */
export function setDataJudApiKey(apiKey: string): void {
  storeApiKey(DATAJUD_API_KEY, apiKey);
}

/**
 * Recupera a chave da API DataJud armazenada
 *
 * @returns Chave da API ou null se nao existir
 *
 * 🔒 AIDEV-SECURITY: A chave retornada e descriptografada, mas nunca logada
 */
export function getDataJudApiKey(): string | null {
  // AIDEV-NOTE: Migration fallback - tenta chave correta primeiro, depois prefixo duplo antigo
  const correct = getApiKey(DATAJUD_API_KEY);
  if (correct) return correct;

  // Fallback: tentar prefixo duplo antigo e migrar
  const legacy = getApiKey('apiKey:datajud');
  if (legacy) {
    // Migra para o lugar correto
    setDataJudApiKey(legacy);
    deleteApiKey('apiKey:datajud');
    return legacy;
  }

  return null;
}

/**
 * Remove a chave da API DataJud armazenada
 *
 * @returns true se a chave foi removida, false se nao existia
 */
export function deleteDataJudApiKey(): boolean {
  return deleteApiKey(DATAJUD_API_KEY);
}

/**
 * Verifica se existe chave da API DataJud armazenada
 *
 * @returns true se existe chave armazenada
 */
export function hasDataJudApiKey(): boolean {
  return getDataJudApiKey() !== null;
}

// =============================================================================
// Escavador Token Storage
// =============================================================================
// AIDEV-NOTE: Metodos para armazenar/recuperar token Bearer do Escavador
// AIDEV-WARNING: O token Bearer do Escavador e armazenado de forma segura via AES-256-GCM
// AIDEV-SECURITY: Token nunca deve ser logado - usar redactEscavadorToken

// AIDEV-WARNING: NÃO adicionar 'apiKey:' aqui - storeApiKey já adiciona o prefixo
// Bug anterior: 'apiKey:escavador' + storeApiKey() = 'apiKey:apiKey:escavador'
const ESCAVADOR_TOKEN_KEY = 'escavador';

/**
 * Armazena o token Bearer do Escavador de forma segura
 *
 * @param token - Token Bearer a ser armazenado
 *
 * 🔒 AIDEV-SECURITY: O token e criptografado antes de ser armazenado
 * ⚠️ AIDEV-NOTE: Validar o token com a API antes de armazenar
 */
export function setEscavadorToken(token: string): void {
  storeApiKey(ESCAVADOR_TOKEN_KEY, token);
}

/**
 * Recupera o token Bearer do Escavador armazenado
 *
 * @returns Token Bearer ou null se nao existir
 *
 * 🔒 AIDEV-SECURITY: O token retornado e descriptografado, mas nunca logado
 */
export function getEscavadorToken(): string | null {
  // AIDEV-NOTE: Migration fallback - tenta chave correta primeiro, depois prefixo duplo antigo
  const correct = getApiKey(ESCAVADOR_TOKEN_KEY);
  if (correct) return correct;

  // Fallback: tentar prefixo duplo antigo e migrar
  const legacy = getApiKey('apiKey:escavador');
  if (legacy) {
    // Migra para o lugar correto
    setEscavadorToken(legacy);
    deleteApiKey('apiKey:escavador');
    return legacy;
  }

  return null;
}

/**
 * Remove o token Bearer do Escavador armazenado
 *
 * @returns true se o token foi removido, false se nao existia
 */
export function deleteEscavadorToken(): boolean {
  return deleteApiKey(ESCAVADOR_TOKEN_KEY);
}

/**
 * Verifica se existe token Bearer do Escavador armazenado
 *
 * @returns true se existe token armazenado
 */
export function hasEscavadorToken(): boolean {
  return getEscavadorToken() !== null;
}
