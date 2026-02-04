/**
 * Jurisiar API - Interface to the Electron main process
 *
 * This module provides type-safe access to the jurisiar API
 * exposed by the preload script via contextBridge.
 */

import type {
  Task,
  TaskConfig,
  TaskUpdateEvent,
  TaskStatus,
  PermissionRequest,
  PermissionResponse,
  TaskProgress,
  ApiKeyConfig,
  TaskMessage,
  BedrockCredentials,
  ProviderSettings,
  ProviderId,
  ConnectedProvider,
  TodoItem,
  ToolSupportStatus,
  FallbackSettings,
  FallbackLogEntry,
} from '@accomplish/shared';

// Define the API interface
interface JurisiarAPI {
  // App info
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;

  // Shell
  openExternal(url: string): Promise<void>;

  // Task operations
  startTask(config: TaskConfig): Promise<Task>;
  cancelTask(taskId: string): Promise<void>;
  interruptTask(taskId: string): Promise<void>;
  getTask(taskId: string): Promise<Task | null>;
  listTasks(): Promise<Task[]>;
  deleteTask(taskId: string): Promise<void>;
  /**
   * @method deleteTasksMany
   * @description Exclui múltiplas tarefas de uma vez
   * @param {string[]} taskIds - Array de IDs das tarefas a serem excluídas
   * @returns {Promise<number>} Número de tarefas excluídas
   * ⚠️ AIDEV-WARNING: Limite de 100 IDs por chamada
   */
  deleteTasksMany(taskIds: string[]): Promise<number>;
  clearTaskHistory(): Promise<void>;

  // Permission responses
  respondToPermission(response: PermissionResponse): Promise<void>;

  // Session management
  resumeSession(sessionId: string, prompt: string, taskId?: string): Promise<Task>;

  // Settings
  getApiKeys(): Promise<ApiKeyConfig[]>;
  addApiKey(provider: 'anthropic' | 'openai' | 'openrouter' | 'google' | 'xai' | 'deepseek' | 'moonshot' | 'zai' | 'azure-foundry' | 'custom' | 'bedrock' | 'litellm' | 'lmstudio' | 'elevenlabs', key: string, label?: string): Promise<ApiKeyConfig>;
  removeApiKey(id: string): Promise<void>;
  getDebugMode(): Promise<boolean>;
  setDebugMode(enabled: boolean): Promise<void>;
  getAppSettings(): Promise<{ debugMode: boolean; onboardingComplete: boolean }>;
  getOpenAiBaseUrl(): Promise<string>;
  setOpenAiBaseUrl(baseUrl: string): Promise<void>;
  getOpenAiOauthStatus(): Promise<{ connected: boolean; expires?: number }>;
  loginOpenAiWithChatGpt(): Promise<{ ok: boolean; openedUrl?: string }>;

  // API Key management
  hasApiKey(): Promise<boolean>;
  setApiKey(key: string): Promise<void>;
  getApiKey(): Promise<string | null>;
  validateApiKey(key: string): Promise<{ valid: boolean; error?: string }>;
  validateApiKeyForProvider(provider: string, key: string, options?: Record<string, any>): Promise<{ valid: boolean; error?: string }>;
  clearApiKey(): Promise<void>;

  // Multi-provider API keys
  getAllApiKeys(): Promise<Record<string, { exists: boolean; prefix?: string }>>;
  hasAnyApiKey(): Promise<boolean>;

  // Onboarding
  getOnboardingComplete(): Promise<boolean>;
  setOnboardingComplete(complete: boolean): Promise<void>;

  // Claude CLI
  checkClaudeCli(): Promise<{ installed: boolean; version: string | null; installCommand: string }>;
  getClaudeVersion(): Promise<string | null>;

  // Model selection
  getSelectedModel(): Promise<{ provider: string; model: string; baseUrl?: string; deploymentName?: string } | null>;
  setSelectedModel(model: { provider: string; model: string; baseUrl?: string; deploymentName?: string }): Promise<void>;

  // Ollama configuration
  testOllamaConnection(url: string): Promise<{
    success: boolean;
    models?: Array<{ id: string; displayName: string; size: number; toolSupport?: ToolSupportStatus }>;
    error?: string;
  }>;
  getOllamaConfig(): Promise<{ baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; displayName: string; size: number; toolSupport?: ToolSupportStatus }> } | null>;
  setOllamaConfig(config: { baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; displayName: string; size: number; toolSupport?: ToolSupportStatus }> } | null): Promise<void>;

  // Azure Foundry configuration
  getAzureFoundryConfig(): Promise<{ baseUrl: string; deploymentName: string; authType: 'api-key' | 'entra-id'; enabled: boolean; lastValidated?: number } | null>;
  setAzureFoundryConfig(config: { baseUrl: string; deploymentName: string; authType: 'api-key' | 'entra-id'; enabled: boolean; lastValidated?: number } | null): Promise<void>;
  testAzureFoundryConnection(config: { endpoint: string; deploymentName: string; authType: 'api-key' | 'entra-id'; apiKey?: string }): Promise<{ success: boolean; error?: string }>;
  saveAzureFoundryConfig(config: { endpoint: string; deploymentName: string; authType: 'api-key' | 'entra-id'; apiKey?: string }): Promise<void>;

  // OpenRouter configuration
  fetchOpenRouterModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }>;

  // LiteLLM configuration
  testLiteLLMConnection(url: string, apiKey?: string): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }>;
  fetchLiteLLMModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }>;
  getLiteLLMConfig(): Promise<{ baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; name: string; provider: string; contextLength: number }> } | null>;
  setLiteLLMConfig(config: { baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; name: string; provider: string; contextLength: number }> } | null): Promise<void>;

  // LM Studio configuration
  testLMStudioConnection(url: string): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; toolSupport: ToolSupportStatus }>;
    error?: string;
  }>;
  fetchLMStudioModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; toolSupport: ToolSupportStatus }>;
    error?: string;
  }>;
  getLMStudioConfig(): Promise<{
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{ id: string; name: string; toolSupport: ToolSupportStatus }>;
  } | null>;
  setLMStudioConfig(config: {
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{ id: string; name: string; toolSupport: ToolSupportStatus }>;
  } | null): Promise<void>;

  // Bedrock configuration
  validateBedrockCredentials(credentials: string): Promise<{ valid: boolean; error?: string }>;
  saveBedrockCredentials(credentials: string): Promise<ApiKeyConfig>;
  getBedrockCredentials(): Promise<BedrockCredentials | null>;
  fetchBedrockModels(credentials: string): Promise<{ success: boolean; models: Array<{ id: string; name: string; provider: string }>; error?: string }>;

  // E2E Testing
  isE2EMode(): Promise<boolean>;

  // Provider Settings API
  getProviderSettings(): Promise<ProviderSettings>;
  setActiveProvider(providerId: ProviderId | null): Promise<void>;
  getConnectedProvider(providerId: ProviderId): Promise<ConnectedProvider | null>;
  setConnectedProvider(providerId: ProviderId, provider: ConnectedProvider): Promise<void>;
  removeConnectedProvider(providerId: ProviderId): Promise<void>;
  updateProviderModel(providerId: ProviderId, modelId: string | null): Promise<void>;
  setProviderDebugMode(enabled: boolean): Promise<void>;
  getProviderDebugMode(): Promise<boolean>;

  // Event subscriptions
  onTaskUpdate(callback: (event: TaskUpdateEvent) => void): () => void;
  onTaskUpdateBatch?(callback: (event: { taskId: string; messages: TaskMessage[] }) => void): () => void;
  onPermissionRequest(callback: (request: PermissionRequest) => void): () => void;
  onTaskProgress(callback: (progress: TaskProgress) => void): () => void;
  onDebugLog(callback: (log: unknown) => void): () => void;
  onDebugModeChange?(callback: (data: { enabled: boolean }) => void): () => void;
  onTaskStatusChange?(callback: (data: { taskId: string; status: TaskStatus }) => void): () => void;
  onTaskSummary?(callback: (data: { taskId: string; summary: string }) => void): () => void;
  onTodoUpdate?(callback: (data: { taskId: string; todos: TodoItem[] }) => void): () => void;
  onAuthError?(callback: (data: { providerId: string; message: string }) => void): () => void;

  // Speech-to-Text
  speechIsConfigured(): Promise<boolean>;
  speechGetConfig(): Promise<{ enabled: boolean; hasApiKey: boolean; apiKeyPrefix?: string }>;
  speechValidate(apiKey?: string): Promise<{ valid: boolean; error?: string }>;
  speechTranscribe(audioData: ArrayBuffer, mimeType?: string): Promise<{
    success: true;
    result: { text: string; confidence?: number; duration: number; timestamp: number };
  } | {
    success: false;
    error: { code: string; message: string };
  }>;

  // Logging
  logEvent(payload: { level?: string; message: string; context?: Record<string, unknown> }): Promise<unknown>;
  exportLogs(): Promise<{ success: boolean; path?: string; error?: string; reason?: string }>;

  // ============================================================================
  // Window Controls API (for TitleBar)
  // ============================================================================
  // AIDEV-NOTE: Window control methods for custom title bar
  // AIDEV-WARNING: These are optional and may not be implemented yet

  /** Check if window is maximized */
  isWindowMaximized?(): Promise<boolean>;
  /** Minimize the window */
  minimizeWindow?(): void;
  /** Maximize/restore the window */
  maximizeWindow?(): void;
  /** Close the window */
  closeWindow?(): void;
  /** Subscribe to window state changes */
  onWindowStateChange?(callback: (state: { isMaximized: boolean }) => void): () => void;

  // ============================================================================
  // Fallback Settings API
  // ============================================================================
  // AIDEV-NOTE: Provides access to fallback system configuration and logging
  // AIDEV-WARNING: This API interacts with SQLite via IPC

  /** Fallback system API */
  fallback?: {
    /** Get current fallback settings */
    getSettings(): Promise<FallbackSettings>;
    /** Update fallback settings (partial update supported) */
    setSettings(settings: Partial<FallbackSettings>): Promise<FallbackSettings>;
    /** Get fallback event logs with optional limit */
    getLogs(limit?: number): Promise<FallbackLogEntry[]>;
    /** Clear all fallback event logs */
    clearLogs(): Promise<void>;
    /** Get fallback usage statistics */
    getStats(): Promise<{
      totalEvents: number;
      successfulEvents: number;
      failedEvents: number;
      successRate: number;
      avgDurationMs: number | null;
    }>;
  };

  // ============================================================================
  // Auth API (Supabase Authentication)
  // ============================================================================
  // AIDEV-NOTE: Provides access to authentication functions
  // AIDEV-WARNING: Tokens are stored securely via electron-store with AES-256-GCM
  // AIDEV-SECURITY: Never log token values

  /** Authentication API */
  auth?: {
    /** Get Supabase configuration (URL and anon key) */
    getSupabaseConfig(): Promise<{ url: string; anonKey: string }>;
    /** Store authentication token securely */
    storeToken(token: {
      accessToken: string;
      refreshToken: string;
      expiresAt?: number;
    }): Promise<{ success: boolean }>;
    /** Get stored authentication token */
    getToken(): Promise<{
      accessToken: string;
      refreshToken: string;
      expiresAt?: number;
    } | null>;
    /** Clear stored authentication token (logout) */
    clearToken(): Promise<{ success: boolean }>;
    /** Check if authentication token exists */
    hasToken(): Promise<boolean>;
  };
}

interface JurisiarShell {
  version: string;
  platform: string;
  isElectron: true;
}

// Extend Window interface
declare global {
  interface Window {
    jurisiar?: JurisiarAPI;
    jurisiarShell?: JurisiarShell;
  }
}

/**
 * Get the jurisiar API
 * Throws if not running in Electron
 */
export function getJurisiar() {
  if (!window.jurisiar) {
    throw new Error('Jurisiar API not available - not running in Electron');
  }
  return {
    ...window.jurisiar,

    validateBedrockCredentials: async (credentials: BedrockCredentials): Promise<{ valid: boolean; error?: string }> => {
      return window.jurisiar!.validateBedrockCredentials(JSON.stringify(credentials));
    },

    saveBedrockCredentials: async (credentials: BedrockCredentials): Promise<ApiKeyConfig> => {
      return window.jurisiar!.saveBedrockCredentials(JSON.stringify(credentials));
    },

    getBedrockCredentials: async (): Promise<BedrockCredentials | null> => {
      return window.jurisiar!.getBedrockCredentials();
    },

    fetchBedrockModels: (credentials: string) => window.jurisiar!.fetchBedrockModels(credentials),
  };
}

/**
 * Check if running in Electron shell
 */
export function isRunningInElectron(): boolean {
  return window.jurisiarShell?.isElectron === true;
}

/**
 * Get shell version if available
 */
export function getShellVersion(): string | null {
  return window.jurisiarShell?.version ?? null;
}

/**
 * Get shell platform if available
 */
export function getShellPlatform(): string | null {
  return window.jurisiarShell?.platform ?? null;
}

/**
 * React hook to use the jurisiar API
 */
export function useJurisiar(): JurisiarAPI {
  const api = window.jurisiar;
  if (!api) {
    throw new Error('Jurisiar API not available - not running in Electron');
  }
  return api;
}

// ============================================================================
// Fallback Settings API
// ============================================================================
/**
 * @description Typed wrapper for fallback system API
 *
 * @example
 * import { fallback } from '@/lib/jurisiar';
 * const settings = await fallback.getSettings();
 * await fallback.setSettings({ enabled: true });
 *
 * AIDEV-NOTE: This wrapper provides type-safe access to fallback IPC handlers
 * AIDEV-WARNING: Throws if called outside Electron context
 */
export const fallback = {
  /**
   * Get current fallback settings
   * @returns {Promise<FallbackSettings>} Current fallback configuration
   */
  getSettings: (): Promise<FallbackSettings> => {
    if (!window.jurisiar?.fallback) {
      throw new Error('Fallback API not available');
    }
    return window.jurisiar.fallback.getSettings();
  },

  /**
   * Update fallback settings (partial update supported)
   * @param {Partial<FallbackSettings>} settings - Settings to update
   * @returns {Promise<FallbackSettings>} Updated fallback configuration
   */
  setSettings: (settings: Partial<FallbackSettings>): Promise<FallbackSettings> => {
    if (!window.jurisiar?.fallback) {
      throw new Error('Fallback API not available');
    }
    return window.jurisiar.fallback.setSettings(settings);
  },

  /**
   * Get fallback event logs with optional limit
   * @param {number} [limit] - Maximum number of entries to return (default: 100)
   * @returns {Promise<FallbackLogEntry[]>} Array of log entries, newest first
   */
  getLogs: (limit?: number): Promise<FallbackLogEntry[]> => {
    if (!window.jurisiar?.fallback) {
      throw new Error('Fallback API not available');
    }
    return window.jurisiar.fallback.getLogs(limit);
  },

  /**
   * Clear all fallback event logs
   * @returns {Promise<void>}
   */
  clearLogs: (): Promise<void> => {
    if (!window.jurisiar?.fallback) {
      throw new Error('Fallback API not available');
    }
    return window.jurisiar.fallback.clearLogs();
  },

  /**
   * Get fallback usage statistics
   * @returns {Promise<object>} Statistics about fallback usage
   */
  getStats: (): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    avgDurationMs: number | null;
  }> => {
    if (!window.jurisiar?.fallback) {
      throw new Error('Fallback API not available');
    }
    return window.jurisiar.fallback.getStats();
  },
};
