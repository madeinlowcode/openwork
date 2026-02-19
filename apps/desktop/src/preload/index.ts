/**
 * Preload Script for Local Renderer
 *
 * This preload script exposes a secure API to the local React renderer
 * for communicating with the Electron main process via IPC.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose the jurisiar API to the renderer
const jurisiarAPI = {
  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),

  // Shell
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:open-external', url),

  // Task operations
  startTask: (config: { description: string }): Promise<unknown> =>
    ipcRenderer.invoke('task:start', config),
  cancelTask: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('task:cancel', taskId),
  interruptTask: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('task:interrupt', taskId),
  getTask: (taskId: string): Promise<unknown> =>
    ipcRenderer.invoke('task:get', taskId),
  listTasks: (): Promise<unknown[]> => ipcRenderer.invoke('task:list'),
  deleteTask: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('task:delete', taskId),
  /**
   * @method deleteTasksMany
   * @description Exclui múltiplas tarefas de uma vez
   *
   * @param {string[]} taskIds - Array de IDs das tarefas a serem excluídas
   * @returns {Promise<number>} Número de tarefas excluídas
   *
   * ⚠️ AIDEV-WARNING: Limite de 100 IDs por chamada
   */
  deleteTasksMany: (taskIds: string[]): Promise<number> =>
    ipcRenderer.invoke('task:delete-many', taskIds),
  clearTaskHistory: (): Promise<void> => ipcRenderer.invoke('task:clear-history'),

  // Permission responses
  respondToPermission: (response: { taskId: string; allowed: boolean }): Promise<void> =>
    ipcRenderer.invoke('permission:respond', response),

  // Session management
  resumeSession: (sessionId: string, prompt: string, taskId?: string): Promise<unknown> =>
    ipcRenderer.invoke('session:resume', sessionId, prompt, taskId),

  // Settings
  getApiKeys: (): Promise<unknown[]> => ipcRenderer.invoke('settings:api-keys'),
  addApiKey: (
    provider: 'anthropic' | 'openai' | 'openrouter' | 'google' | 'xai' | 'deepseek' | 'moonshot' | 'zai' | 'azure-foundry' | 'custom' | 'bedrock' | 'litellm' | 'lmstudio' | 'elevenlabs',
    key: string,
    label?: string
  ): Promise<unknown> =>
    ipcRenderer.invoke('settings:add-api-key', provider, key, label),
  removeApiKey: (id: string): Promise<void> =>
    ipcRenderer.invoke('settings:remove-api-key', id),
  getDebugMode: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:debug-mode'),
  setDebugMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:set-debug-mode', enabled),
  getAppSettings: (): Promise<{ debugMode: boolean; onboardingComplete: boolean }> =>
    ipcRenderer.invoke('settings:app-settings'),
  getOpenAiBaseUrl: (): Promise<string> =>
    ipcRenderer.invoke('settings:openai-base-url:get'),
  setOpenAiBaseUrl: (baseUrl: string): Promise<void> =>
    ipcRenderer.invoke('settings:openai-base-url:set', baseUrl),
  getOpenAiOauthStatus: (): Promise<{ connected: boolean; expires?: number }> =>
    ipcRenderer.invoke('opencode:auth:openai:status'),
  loginOpenAiWithChatGpt: (): Promise<{ ok: boolean; openedUrl?: string }> =>
    ipcRenderer.invoke('opencode:auth:openai:login'),

  // API Key management (new simplified handlers)
  hasApiKey: (): Promise<boolean> =>
    ipcRenderer.invoke('api-key:exists'),
  setApiKey: (key: string): Promise<void> =>
    ipcRenderer.invoke('api-key:set', key),
  getApiKey: (): Promise<string | null> =>
    ipcRenderer.invoke('api-key:get'),
  validateApiKey: (key: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('api-key:validate', key),
  validateApiKeyForProvider: (provider: string, key: string, options?: Record<string, any>): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('api-key:validate-provider', provider, key, options),
  clearApiKey: (): Promise<void> =>
    ipcRenderer.invoke('api-key:clear'),

  // Onboarding
  getOnboardingComplete: (): Promise<boolean> =>
    ipcRenderer.invoke('onboarding:complete'),
  setOnboardingComplete: (complete: boolean): Promise<void> =>
    ipcRenderer.invoke('onboarding:set-complete', complete),

  // OpenCode CLI status
  checkOpenCodeCli: (): Promise<{
    installed: boolean;
    version: string | null;
    installCommand: string;
  }> => ipcRenderer.invoke('opencode:check'),
  getOpenCodeVersion: (): Promise<string | null> =>
    ipcRenderer.invoke('opencode:version'),

  // Model selection
  getSelectedModel: (): Promise<{ provider: string; model: string; baseUrl?: string; deploymentName?: string } | null> =>
    ipcRenderer.invoke('model:get'),
  setSelectedModel: (model: { provider: string; model: string; baseUrl?: string; deploymentName?: string }): Promise<void> =>
    ipcRenderer.invoke('model:set', model),

  // Multi-provider API keys
  getAllApiKeys: (): Promise<Record<string, { exists: boolean; prefix?: string }>> =>
    ipcRenderer.invoke('api-keys:all'),
  hasAnyApiKey: (): Promise<boolean> =>
    ipcRenderer.invoke('api-keys:has-any'),

  // Ollama configuration
  testOllamaConnection: (url: string): Promise<{
    success: boolean;
    models?: Array<{ id: string; displayName: string; size: number; toolSupport?: 'supported' | 'unsupported' | 'unknown' }>;
    error?: string;
  }> => ipcRenderer.invoke('ollama:test-connection', url),

  getOllamaConfig: (): Promise<{ baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; displayName: string; size: number; toolSupport?: 'supported' | 'unsupported' | 'unknown' }> } | null> =>
    ipcRenderer.invoke('ollama:get-config'),

  setOllamaConfig: (config: { baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; displayName: string; size: number; toolSupport?: 'supported' | 'unsupported' | 'unknown' }> } | null): Promise<void> =>
    ipcRenderer.invoke('ollama:set-config', config),

  // Azure Foundry configuration
  getAzureFoundryConfig: (): Promise<{ baseUrl: string; deploymentName: string; authType: 'api-key' | 'entra-id'; enabled: boolean; lastValidated?: number } | null> =>
    ipcRenderer.invoke('azure-foundry:get-config'),

  setAzureFoundryConfig: (config: { baseUrl: string; deploymentName: string; authType: 'api-key' | 'entra-id'; enabled: boolean; lastValidated?: number } | null): Promise<void> =>
    ipcRenderer.invoke('azure-foundry:set-config', config),

  testAzureFoundryConnection: (config: { endpoint: string; deploymentName: string; authType: 'api-key' | 'entra-id'; apiKey?: string }): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('azure-foundry:test-connection', config),

  saveAzureFoundryConfig: (config: { endpoint: string; deploymentName: string; authType: 'api-key' | 'entra-id'; apiKey?: string }): Promise<void> =>
    ipcRenderer.invoke('azure-foundry:save-config', config),

  // OpenRouter configuration
  fetchOpenRouterModels: (): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('openrouter:fetch-models'),

  // LiteLLM configuration
  testLiteLLMConnection: (url: string, apiKey?: string): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('litellm:test-connection', url, apiKey),

  fetchLiteLLMModels: (): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('litellm:fetch-models'),

  getLiteLLMConfig: (): Promise<{ baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; name: string; provider: string; contextLength: number }> } | null> =>
    ipcRenderer.invoke('litellm:get-config'),

  setLiteLLMConfig: (config: { baseUrl: string; enabled: boolean; lastValidated?: number; models?: Array<{ id: string; name: string; provider: string; contextLength: number }> } | null): Promise<void> =>
    ipcRenderer.invoke('litellm:set-config', config),

  // LM Studio configuration
  testLMStudioConnection: (url: string): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; toolSupport: 'supported' | 'unsupported' | 'unknown' }>;
    error?: string;
  }> => ipcRenderer.invoke('lmstudio:test-connection', url),

  fetchLMStudioModels: (): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; toolSupport: 'supported' | 'unsupported' | 'unknown' }>;
    error?: string;
  }> => ipcRenderer.invoke('lmstudio:fetch-models'),

  getLMStudioConfig: (): Promise<{
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{ id: string; name: string; toolSupport: 'supported' | 'unsupported' | 'unknown' }>;
  } | null> => ipcRenderer.invoke('lmstudio:get-config'),

  setLMStudioConfig: (config: {
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{ id: string; name: string; toolSupport: 'supported' | 'unsupported' | 'unknown' }>;
  } | null): Promise<void> => ipcRenderer.invoke('lmstudio:set-config', config),

  // Bedrock
  validateBedrockCredentials: (credentials: string) =>
    ipcRenderer.invoke('bedrock:validate', credentials),
  saveBedrockCredentials: (credentials: string) =>
    ipcRenderer.invoke('bedrock:save', credentials),
  getBedrockCredentials: () =>
    ipcRenderer.invoke('bedrock:get-credentials'),
  fetchBedrockModels: (credentials: string): Promise<{ success: boolean; models: Array<{ id: string; name: string; provider: string }>; error?: string }> =>
    ipcRenderer.invoke('bedrock:fetch-models', credentials),

  // E2E Testing
  isE2EMode: (): Promise<boolean> =>
    ipcRenderer.invoke('app:is-e2e-mode'),

  // New Provider Settings API
  getProviderSettings: (): Promise<unknown> =>
    ipcRenderer.invoke('provider-settings:get'),
  setActiveProvider: (providerId: string | null): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-active', providerId),
  getConnectedProvider: (providerId: string): Promise<unknown> =>
    ipcRenderer.invoke('provider-settings:get-connected', providerId),
  setConnectedProvider: (providerId: string, provider: unknown): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-connected', providerId, provider),
  removeConnectedProvider: (providerId: string): Promise<void> =>
    ipcRenderer.invoke('provider-settings:remove-connected', providerId),
  updateProviderModel: (providerId: string, modelId: string | null): Promise<void> =>
    ipcRenderer.invoke('provider-settings:update-model', providerId, modelId),
  setProviderDebugMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-debug', enabled),
  getProviderDebugMode: (): Promise<boolean> =>
    ipcRenderer.invoke('provider-settings:get-debug'),

  // Event subscriptions
  onTaskUpdate: (callback: (event: unknown) => void) => {
    const listener = (_: unknown, event: unknown) => callback(event);
    ipcRenderer.on('task:update', listener);
    return () => ipcRenderer.removeListener('task:update', listener);
  },
  // Batched task updates for performance - multiple messages in single IPC call
  onTaskUpdateBatch: (callback: (event: { taskId: string; messages: unknown[] }) => void) => {
    const listener = (_: unknown, event: { taskId: string; messages: unknown[] }) => callback(event);
    ipcRenderer.on('task:update:batch', listener);
    return () => ipcRenderer.removeListener('task:update:batch', listener);
  },
  onPermissionRequest: (callback: (request: unknown) => void) => {
    const listener = (_: unknown, request: unknown) => callback(request);
    ipcRenderer.on('permission:request', listener);
    return () => ipcRenderer.removeListener('permission:request', listener);
  },
  onTaskProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on('task:progress', listener);
    return () => ipcRenderer.removeListener('task:progress', listener);
  },
  onDebugLog: (callback: (log: unknown) => void) => {
    const listener = (_: unknown, log: unknown) => callback(log);
    ipcRenderer.on('debug:log', listener);
    return () => ipcRenderer.removeListener('debug:log', listener);
  },
  // Debug mode setting changes
  onDebugModeChange: (callback: (data: { enabled: boolean }) => void) => {
    const listener = (_: unknown, data: { enabled: boolean }) => callback(data);
    ipcRenderer.on('settings:debug-mode-changed', listener);
    return () => ipcRenderer.removeListener('settings:debug-mode-changed', listener);
  },
  // Task status changes (e.g., queued -> running)
  onTaskStatusChange: (callback: (data: { taskId: string; status: string }) => void) => {
    const listener = (_: unknown, data: { taskId: string; status: string }) => callback(data);
    ipcRenderer.on('task:status-change', listener);
    return () => ipcRenderer.removeListener('task:status-change', listener);
  },
  // Task summary updates (AI-generated summary)
  onTaskSummary: (callback: (data: { taskId: string; summary: string }) => void) => {
    const listener = (_: unknown, data: { taskId: string; summary: string }) => callback(data);
    ipcRenderer.on('task:summary', listener);
    return () => ipcRenderer.removeListener('task:summary', listener);
  },
  // Todo updates from OpenCode todowrite tool
  onTodoUpdate: (callback: (data: { taskId: string; todos: Array<{ id: string; content: string; status: string; priority: string }> }) => void) => {
    const listener = (_: unknown, data: { taskId: string; todos: Array<{ id: string; content: string; status: string; priority: string }> }) => callback(data);
    ipcRenderer.on('todo:update', listener);
    return () => ipcRenderer.removeListener('todo:update', listener);
  },
  // Auth error events (e.g., OAuth token expired)
  onAuthError: (callback: (data: { providerId: string; message: string }) => void) => {
    const listener = (_: unknown, data: { providerId: string; message: string }) => callback(data);
    ipcRenderer.on('auth:error', listener);
    return () => ipcRenderer.removeListener('auth:error', listener);
  },

  // ============================================================================
  // Fallback System Event Subscriptions
  // ============================================================================
  // AIDEV-NOTE: Events for monitoring automatic model switching on rate limit
  // AIDEV-WARNING: UI should handle these for user feedback

  /** Emitted when fallback to alternate model starts */
  onFallbackStarted: (callback: (data: {
    taskId: string;
    originalModel: string;
    originalProvider: string;
    fallbackModel: string;
    fallbackProvider: string;
    errorType: string;
  }) => void) => {
    const listener = (_: unknown, data: {
      taskId: string;
      originalModel: string;
      originalProvider: string;
      fallbackModel: string;
      fallbackProvider: string;
      errorType: string;
    }) => callback(data);
    ipcRenderer.on('fallback:started', listener);
    return () => ipcRenderer.removeListener('fallback:started', listener);
  },

  /** Emitted when fallback completes (success or failure) */
  onFallbackCompleted: (callback: (data: {
    taskId: string;
    success: boolean;
    durationMs: number;
  }) => void) => {
    const listener = (_: unknown, data: {
      taskId: string;
      success: boolean;
      durationMs: number;
    }) => callback(data);
    ipcRenderer.on('fallback:completed', listener);
    return () => ipcRenderer.removeListener('fallback:completed', listener);
  },

  /** Emitted when fallback fails to initiate */
  onFallbackFailed: (callback: (data: {
    taskId: string;
    error: string;
    phase: string;
  }) => void) => {
    const listener = (_: unknown, data: {
      taskId: string;
      error: string;
      phase: string;
    }) => callback(data);
    ipcRenderer.on('fallback:failed', listener);
    return () => ipcRenderer.removeListener('fallback:failed', listener);
  },

  logEvent: (payload: { level?: string; message: string; context?: Record<string, unknown> }) =>
    ipcRenderer.invoke('log:event', payload),

  // Export application logs
  exportLogs: (): Promise<{ success: boolean; path?: string; error?: string; reason?: string }> =>
    ipcRenderer.invoke('logs:export'),

  // Speech-to-Text API
  speechIsConfigured: (): Promise<boolean> =>
    ipcRenderer.invoke('speech:is-configured'),
  speechGetConfig: (): Promise<{ enabled: boolean; hasApiKey: boolean; apiKeyPrefix?: string }> =>
    ipcRenderer.invoke('speech:get-config'),
  speechValidate: (apiKey?: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('speech:validate', apiKey),
  speechTranscribe: (audioData: ArrayBuffer, mimeType?: string): Promise<{
    success: true;
    result: { text: string; confidence?: number; duration: number; timestamp: number };
  } | {
    success: false;
    error: { code: string; message: string };
  }> => ipcRenderer.invoke('speech:transcribe', audioData, mimeType),

  // ============================================================================
  // Fallback Settings API
  // ============================================================================
  // AIDEV-NOTE: Exposes fallback system configuration and logging to renderer
  // AIDEV-WARNING: Settings are stored in SQLite via fallback_settings table

  fallback: {
    /** Get current fallback settings */
    getSettings: (): Promise<{
      enabled: boolean;
      fallbackModelId: string | null;
      fallbackProvider: string;
      maxRetries: number;
      retryDelayMs: number;
      useLLMSummarization: boolean;
      summarizationModelId: string | null;
      summarizationProvider: string;
    }> => ipcRenderer.invoke('fallback:get-settings'),

    /** Update fallback settings (partial update supported) */
    setSettings: (settings: Partial<{
      enabled: boolean;
      fallbackModelId: string | null;
      fallbackProvider: string;
      maxRetries: number;
      retryDelayMs: number;
      useLLMSummarization: boolean;
      summarizationModelId: string | null;
      summarizationProvider: string;
    }>): Promise<{
      enabled: boolean;
      fallbackModelId: string | null;
      fallbackProvider: string;
      maxRetries: number;
      retryDelayMs: number;
      useLLMSummarization: boolean;
      summarizationModelId: string | null;
      summarizationProvider: string;
    }> => ipcRenderer.invoke('fallback:set-settings', settings),

    /** Get fallback event logs with optional limit */
    getLogs: (limit?: number): Promise<Array<{
      id?: number;
      taskId: string;
      sessionId?: string;
      originalModel?: string;
      originalProvider?: string;
      fallbackModel?: string;
      fallbackProvider?: string;
      errorType?: string;
      errorMessage?: string;
      contextMethod?: 'template' | 'llm';
      contextTokens?: number;
      success: boolean;
      durationMs?: number;
      createdAt?: string;
    }>> => ipcRenderer.invoke('fallback:get-logs', limit),

    /** Clear all fallback event logs */
    clearLogs: (): Promise<void> => ipcRenderer.invoke('fallback:clear-logs'),

    /** Get fallback usage statistics */
    getStats: (): Promise<{
      totalEvents: number;
      successfulEvents: number;
      failedEvents: number;
      successRate: number;
      avgDurationMs: number | null;
    }> => ipcRenderer.invoke('fallback:get-stats'),
  },

  // ============================================================================
  // Auth API (Supabase Authentication)
  // ============================================================================
  // AIDEV-NOTE: Exposes authentication methods to renderer process
  // AIDEV-WARNING: Tokens are stored securely via electron-store with AES-256-GCM
  // AIDEV-SECURITY: Never log token values in renderer or main process

  auth: {
    /** Get Supabase configuration (URL and anon key) */
    getSupabaseConfig: (): Promise<{ url: string; anonKey: string }> =>
      ipcRenderer.invoke('auth:get-supabase-config'),

    /** Store authentication token securely */
    storeToken: (token: {
      accessToken: string;
      refreshToken: string;
      expiresAt?: number;
    }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('auth:store-token', token),

    /** Get stored authentication token */
    getToken: (): Promise<{
      accessToken: string;
      refreshToken: string;
      expiresAt?: number;
    } | null> => ipcRenderer.invoke('auth:get-token'),

    /** Clear stored authentication token (logout) */
    clearToken: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('auth:clear-token'),

    /** Check if authentication token exists */
    hasToken: (): Promise<boolean> =>
      ipcRenderer.invoke('auth:has-token'),
  },

  // ============================================================================
  // Token Usage API
  // ============================================================================
  // AIDEV-NOTE: Exposes read-only token usage analytics to renderer
  // AIDEV-WARNING: No mutation methods exposed - data is written by adapter only

  tokenUsage: {
    /** Get all usage records for a task */
    getByTask: (taskId: string): Promise<Array<{
      taskId: string;
      sessionId?: string;
      userId?: string;
      modelId: string;
      provider: string;
      source: 'primary' | 'retry' | 'fallback' | 'continuation' | 'summarization';
      stepNumber?: number;
      inputTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      costUsd?: number;
      costEstimated?: number;
      isEstimated: boolean;
      stepCount: number;
    }>> => ipcRenderer.invoke('token-usage:get-by-task', taskId),

    /** Get aggregated summary for a task */
    getSummary: (taskId: string): Promise<{
      taskId: string;
      totalInput: number;
      totalOutput: number;
      totalReasoning: number;
      totalCost: number;
      totalCostEstimated: number;
      modelsUsed: string;
      sourcesUsed: string;
      totalEntries: number;
    } | null> => ipcRenderer.invoke('token-usage:get-summary', taskId),

    /** Get daily usage summary for the last N days */
    getDailySummary: (days?: number): Promise<Array<{
      date: string;
      totalInput: number;
      totalOutput: number;
      totalCost: number;
      taskCount: number;
    }>> => ipcRenderer.invoke('token-usage:get-daily-summary', days ?? 30),

    /** Get token usage logs with task info (JOIN) for Logs tab */
    getLogs: (options?: { limit?: number; provider?: string }): Promise<unknown[]> =>
      ipcRenderer.invoke('token-usage:get-logs', options),
  },

  // ============================================================================
  // DataJud API
  // ============================================================================
  // AIDEV-NOTE: Exposes DataJud API methods to renderer for judiciary search
  // AIDEV-WARNING: API keys are never exposed - only masked values returned

  datajud: {
    /** Check if DataJud API key is configured */
    isConfigured: (): Promise<boolean> =>
      ipcRenderer.invoke('datajud:is-configured'),

    /** Set DataJud API key (validates before storing) */
    setApiKey: (apiKey: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('datajud:set-api-key', apiKey),

    /** Get masked API key status */
    getApiKey: (): Promise<{ hasKey: boolean; maskedKey?: string }> =>
      ipcRenderer.invoke('datajud:get-api-key'),

    /** Delete stored API key */
    deleteApiKey: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('datajud:delete-api-key'),

    /** Validate API key (optionally with provided key) */
    validateKey: (apiKey?: string): Promise<{ valid: boolean; error?: string }> =>
      ipcRenderer.invoke('datajud:validate-key', apiKey),

    /** Get all available courts */
    getCourts: (): Promise<Array<{
      alias: string;
      name: string;
      category: string;
      state?: string;
      isActive: boolean;
    }>> => ipcRenderer.invoke('datajud:get-courts'),

    /** Get court by alias */
    getCourt: (alias: string): Promise<{
      alias: string;
      name: string;
      category: string;
      state?: string;
      isActive: boolean;
    } | null> => ipcRenderer.invoke('datajud:get-court', alias),

    /** Get courts by category */
    getCourtsByCategory: (category: string): Promise<Array<{
      alias: string;
      name: string;
      category: string;
      state?: string;
      isActive: boolean;
    }>> => ipcRenderer.invoke('datajud:get-courts-by-category', category),

    /** Perform general search */
    search: (query: {
      court: string;
      queryType: string;
      value: string;
      size?: number;
      filters?: {
        dateFrom?: string;
        dateTo?: string;
        instance?: string;
        courtFilter?: string;
      };
    }): Promise<{ success: boolean; result?: unknown; error?: string }> =>
      ipcRenderer.invoke('datajud:search', query),

    /** Search by process number */
    searchByNumber: (court: string, processNumber: string, options?: { size?: number }): Promise<{
      success: boolean;
      result?: unknown;
      error?: string;
    }> => ipcRenderer.invoke('datajud:search-by-number', court, processNumber, options),

    /** Search by procedural class */
    searchByClass: (court: string, classCode: string, options?: {
      size?: number;
      dateFrom?: string;
      dateTo?: string;
      instance?: string;
    }): Promise<{ success: boolean; result?: unknown; error?: string }> =>
      ipcRenderer.invoke('datajud:search-by-class', court, classCode, options),

    /** Search by party name */
    searchByParty: (court: string, partyName: string, options?: { size?: number }): Promise<{
      success: boolean;
      result?: unknown;
      error?: string;
    }> => ipcRenderer.invoke('datajud:search-by-party', court, partyName, options),

    /** Search by date range */
    searchByDateRange: (court: string, dateFrom: string, dateTo: string, options?: {
      size?: number;
      instance?: string;
    }): Promise<{ success: boolean; result?: unknown; error?: string }> =>
      ipcRenderer.invoke('datajud:search-by-date-range', court, dateFrom, dateTo, options),

    /**
     * Search by procedural class + court body (Exemplo 3 DataJud)
     * AIDEV-NOTE: Unico endpoint que suporta search_after com sort em @timestamp
     */
    searchByClassAndCourt: (court: string, classCode: string, orgaoJulgadorCode: string, options?: {
      size?: number;
      searchAfter?: string[];
    }): Promise<{ success: boolean; result?: unknown; error?: string }> =>
      ipcRenderer.invoke('datajud:search-by-class-and-court', court, classCode, orgaoJulgadorCode, options),

    /** Get search history */
    getHistory: (limit?: number): Promise<Array<{
      id: number;
      court: string;
      queryType: string;
      queryValue: string;
      resultCount: number;
      createdAt: number;
    }>> => ipcRenderer.invoke('datajud:get-history', limit),

    /** Delete a history item */
    deleteHistoryItem: (id: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('datajud:delete-history-item', id),

    /** Clear all search history */
    clearHistory: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('datajud:clear-history'),

    /** Get history statistics */
    getHistoryStats: (): Promise<{
      totalSearches: number;
      searchesByCourt: Array<{ court: string; count: number }>;
    } | null> => ipcRenderer.invoke('datajud:get-history-stats'),

    /** Clear search cache */
    clearCache: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('datajud:clear-cache'),
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('jurisiar', jurisiarAPI);

// Also expose shell info for compatibility checks
const packageVersion = process.env.npm_package_version;
if (!packageVersion) {
  throw new Error('Package version is not defined. Build is misconfigured.');
}
contextBridge.exposeInMainWorld('jurisiarShell', {
  version: packageVersion,
  platform: process.platform,
  isElectron: true,
});

// Type declarations
export type JurisiarAPI = typeof jurisiarAPI;
