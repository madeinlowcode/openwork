import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { app } from 'electron';
import fs from 'fs';
import { StreamParser } from './stream-parser';
import { OpenCodeLogWatcher, createLogWatcher, OpenCodeLogError } from './log-watcher';
import { CompletionEnforcer, CompletionEnforcerCallbacks, CompletionFlowState } from './completion';
import {
  getOpenCodeCliPath,
  isOpenCodeBundled,
  getBundledOpenCodeVersion,
} from './cli-path';
import { getAllApiKeys, getBedrockCredentials } from '../store/secureStorage';
import { authClient, WORKER_URL } from '../lib/auth-client';
// TODO: Remove getAzureFoundryConfig import in v0.4.0 when legacy support is dropped
import { getSelectedModel, getAzureFoundryConfig, getOpenAiBaseUrl } from '../store/appSettings';
import { getActiveProviderModel, getConnectedProvider } from '../store/providerSettings';
import type { AzureFoundryCredentials, FallbackSettings } from '@accomplish/shared';
import { generateOpenCodeConfig, ACCOMPLISH_AGENT_NAME, syncApiKeysToOpenCodeAuth } from './config-generator';
import { getAzureEntraToken } from './azure-token-manager';
import { getExtendedNodePath } from '../utils/system-path';
import { getBundledNodePaths, logBundledNodeInfo, getNpxPath } from '../utils/bundled-node';
import { getModelDisplayName } from '../utils/model-display';
import path from 'path';
import { spawn } from 'child_process';
import type {
  TaskConfig,
  Task,
  TaskMessage,
  TaskResult,
  OpenCodeMessage,
  PermissionRequest,
  TodoItem,
} from '@accomplish/shared';

// ============================================================================
// Fallback System Integration
// ============================================================================
// AIDEV-NOTE: Imports for intelligent fallback system
// AIDEV-WARNING: FallbackEngine should be created per-task, not globally
import {
  FallbackEngine,
  createFallbackEngine,
  isRateLimitError,
  RateLimitRetryManager,
  type FallbackHandleResult,
  type FallbackEngineEvents,
} from './fallback';
import { getFallbackSettings } from '../store/repositories/fallbackSettings';

// ============================================================================
// Token Tracking Integration
// ============================================================================
// AIDEV-NOTE: Imports for token usage tracking system
// AIDEV-WARNING: Token persistence must happen BEFORE PTY kill on cancel/interrupt
import { TokenAccumulator, type TokenEntry } from './token-accumulator';
import { CostGuard, DEFAULT_COST_LIMITS } from './cost-guard';
import { OpenCodeFileReader } from './opencode-file-reader';
import * as tokenUsageRepo from '../store/repositories/tokenUsage';

/**
 * Error thrown when OpenCode CLI is not available
 */
export class OpenCodeCliNotFoundError extends Error {
  constructor() {
    super(
      'OpenCode CLI is not available. The bundled CLI may be missing or corrupted. Please reinstall the application.'
    );
    this.name = 'OpenCodeCliNotFoundError';
  }
}

/**
 * Check if OpenCode CLI is available (bundled or installed)
 */
export async function isOpenCodeCliInstalled(): Promise<boolean> {
  return isOpenCodeBundled();
}

/**
 * Get OpenCode CLI version
 */
export async function getOpenCodeCliVersion(): Promise<string | null> {
  return getBundledOpenCodeVersion();
}

/**
 * @interface OpenCodeAdapterEvents
 * @description Events emitted by the OpenCodeAdapter
 *
 * AIDEV-NOTE: Includes fallback system events for rate limit handling
 * AIDEV-WARNING: Changes to event signatures may break IPC handlers
 */
export interface OpenCodeAdapterEvents {
  message: [OpenCodeMessage];
  'tool-use': [string, unknown];
  'tool-result': [string];
  'permission-request': [PermissionRequest];
  progress: [{ stage: string; message?: string; modelName?: string }];
  complete: [TaskResult];
  error: [Error];
  debug: [{ type: string; message: string; data?: unknown }];
  'todo:update': [TodoItem[]];
  'auth-error': [{ providerId: string; message: string }];
  // Fallback system events
  'fallback:started': [FallbackEngineEvents['fallback:start']];
  'fallback:completed': [FallbackEngineEvents['fallback:complete']];
  'fallback:failed': [{ error: string; phase: string }];
  // Token tracking events
  'token-usage:update': [{ totalCost: number; totalInput: number; totalOutput: number; stepCount: number }];
  'token-usage:limit-reached': [{ accumulated: number; max: number }];
  'token-usage:warning': [{ accumulated: number; max: number }];
}

/**
 * @class OpenCodeAdapter
 * @description Adapter for OpenCode CLI execution with integrated fallback system
 *
 * @context Main process - manages task execution lifecycle
 *
 * @dependencies
 * - node-pty (PTY for CLI spawning)
 * - ./fallback (FallbackEngine for rate limit handling)
 * - ./log-watcher (error detection)
 * - ./stream-parser (output parsing)
 *
 * @stateManagement
 * - Tracks task execution state (messages, completion, interruption)
 * - Manages FallbackEngine instance per task
 * - Handles model switching on rate limit errors
 *
 * AIDEV-WARNING: Critical component - changes affect task reliability
 * AIDEV-NOTE: Each task should have its own adapter instance
 */
export class OpenCodeAdapter extends EventEmitter<OpenCodeAdapterEvents> {
  private ptyProcess: pty.IPty | null = null;
  private streamParser: StreamParser;
  private logWatcher: OpenCodeLogWatcher | null = null;
  private currentSessionId: string | null = null;
  private currentTaskId: string | null = null;
  private messages: TaskMessage[] = [];
  private hasCompleted: boolean = false;
  private isDisposed: boolean = false;
  private wasInterrupted: boolean = false;
  private completionEnforcer: CompletionEnforcer;
  private lastWorkingDirectory: string | undefined;
  /** Current model ID for display name */
  private currentModelId: string | null = null;
  /** Current provider for fallback tracking */
  private currentProvider: string | null = null;
  /** Timer for transitioning from 'connecting' to 'waiting' stage */
  private waitingTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether the first tool has been received (to stop showing startup stages) */
  private hasReceivedFirstTool: boolean = false;

  // ============================================================================
  // Fallback System Properties
  // ============================================================================
  // AIDEV-NOTE: FallbackEngine manages automatic model switching on rate limit
  // AIDEV-WARNING: Engine is created per-task and should be disposed with adapter

  /** FallbackEngine instance for handling rate limit errors */
  private fallbackEngine: FallbackEngine | null = null;
  /** Original prompt for task continuation */
  private currentPrompt: string | null = null;
  /** Whether we're currently in a fallback execution */
  private isFallbackExecution: boolean = false;
  /** Whether a fallback restart is in progress (original PTY exit should be ignored) */
  private pendingFallbackRestart: boolean = false;
  /** Retry manager for rate limit retries before fallback */
  private retryManager: RateLimitRetryManager = new RateLimitRetryManager();
  /** Timer for active retry wait (so we can cancel on dispose) */
  private retryWaitTimer: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // Token Tracking Properties
  // ============================================================================
  // AIDEV-NOTE: TokenAccumulator collects per-step data; CostGuard enforces limits
  // AIDEV-WARNING: tokenAccumulator must be persisted BEFORE killing PTY on cancel

  /** In-memory accumulator for token usage during task execution */
  private tokenAccumulator: TokenAccumulator = new TokenAccumulator();
  /** Cost circuit breaker — stops task when budget is exceeded */
  private costGuard: CostGuard | null = null;
  /** Current source phase for token tracking */
  private currentSource: TokenEntry['source'] = 'primary';
  /** Step counter within current source phase */
  private currentStepNumber: number = 0;
  /** File reader for OpenCode CLI storage (post-task enrichment) */
  private fileReader: OpenCodeFileReader = new OpenCodeFileReader();

  /**
   * Create a new OpenCodeAdapter instance
   * @param taskId - Optional task ID for this adapter instance (used for logging)
   */
  constructor(taskId?: string) {
    super();
    this.currentTaskId = taskId || null;
    this.streamParser = new StreamParser();
    this.completionEnforcer = this.createCompletionEnforcer();
    this.setupStreamParsing();
    this.setupLogWatcher();
  }

  /**
   * Create the CompletionEnforcer with callbacks that delegate to adapter methods.
   */
  private createCompletionEnforcer(): CompletionEnforcer {
    const callbacks: CompletionEnforcerCallbacks = {
      onStartContinuation: async (prompt: string) => {
        // AIDEV-NOTE: Mark source as continuation for token tracking
        this.currentSource = 'continuation';
        this.currentStepNumber = 0;
        await this.spawnSessionResumption(prompt);
      },
      onComplete: () => {
        this.hasCompleted = true;
        this.emit('complete', {
          status: 'success',
          sessionId: this.currentSessionId || undefined,
        });
      },
      onDebug: (type: string, message: string, data?: unknown) => {
        this.emit('debug', { type, message, data });
      },
    };
    return new CompletionEnforcer(callbacks);
  }

  /**
   * Set up the log watcher to detect errors from OpenCode CLI logs.
   * The CLI doesn't always output errors as JSON to stdout (e.g., throttling errors),
   * so we monitor the log files directly.
   *
   * AIDEV-NOTE: Integrates with FallbackEngine for rate limit handling
   * AIDEV-WARNING: Rate limit detection triggers automatic model switching
   */
  private setupLogWatcher(): void {
    this.logWatcher = createLogWatcher();

    this.logWatcher.on('error', async (error: OpenCodeLogError) => {
      // Only handle errors if we have an active task that hasn't completed
      if (!this.hasCompleted && this.ptyProcess) {
        console.log('[OpenCode Adapter] Log watcher detected error:', error.errorName);

        const errorMessage = OpenCodeLogWatcher.getErrorMessage(error);

        // Emit debug event so the error appears in the app's debug panel
        this.emit('debug', {
          type: 'error',
          message: `[${error.errorName}] ${errorMessage}`,
          data: {
            errorName: error.errorName,
            statusCode: error.statusCode,
            providerID: error.providerID,
            modelID: error.modelID,
            message: error.message,
          },
        });

        // ================================================================
        // FALLBACK SYSTEM: Check for rate limit errors
        // ================================================================
        // AIDEV-NOTE: Attempt fallback before marking task as failed
        // AIDEV-WARNING: Fallback may restart task with different model
        if (this.fallbackEngine && isRateLimitError(errorMessage)) {
          console.log('[OpenCode Adapter] Rate limit detected, attempting fallback...');

          const fallbackHandled = await this.handleRateLimitWithFallback(errorMessage);
          if (fallbackHandled) {
            // Fallback initiated, don't mark as error
            return;
          }
        }

        // Emit auth-error event if this is an authentication error
        if (error.isAuthError && error.providerID) {
          console.log('[OpenCode Adapter] Emitting auth-error for provider:', error.providerID);
          this.emit('auth-error', {
            providerId: error.providerID,
            message: errorMessage,
          });
        }

        // AIDEV-NOTE: If the agent already called complete_task(success) but the CompletionEnforcer
        // downgraded it to partial (due to incomplete todos) and the continuation fails (rate limit),
        // we should treat this as success since the original work was completed.
        const wasOriginallySuccess = this.completionEnforcer.wasDowngradedFromSuccess();

        this.hasCompleted = true;
        if (wasOriginallySuccess) {
          console.log('[OpenCode Adapter] Continuation failed but original task was success - emitting success');
          this.emit('complete', {
            status: 'success',
            sessionId: this.currentSessionId || undefined,
          });
        } else {
          this.emit('complete', {
            status: 'error',
            sessionId: this.currentSessionId || undefined,
            error: errorMessage,
          });
        }

        // Kill the PTY process since we've detected an error
        if (this.ptyProcess) {
          try {
            this.ptyProcess.kill();
          } catch (err) {
            console.warn('[OpenCode Adapter] Error killing PTY after log error:', err);
          }
          this.ptyProcess = null;
        }
      }
    });
  }

  // ============================================================================
  // Fallback System Methods
  // ============================================================================

  /**
   * Initialize the FallbackEngine for the current task
   *
   * @description Creates and configures the fallback engine based on user settings
   *
   * AIDEV-NOTE: Called at task start, engine is disposed with adapter
   * AIDEV-WARNING: Only creates engine if fallback is enabled in settings
   */
  private async initFallbackEngine(): Promise<void> {
    const settings = getFallbackSettings();

    if (!settings.enabled || !settings.fallbackModelId) {
      console.log('[OpenCode Adapter] Fallback system disabled or not configured');
      this.fallbackEngine = null;
      return;
    }

    console.log('[OpenCode Adapter] Initializing FallbackEngine with settings:', {
      enabled: settings.enabled,
      fallbackModel: settings.fallbackModelId,
      maxRetries: settings.maxRetries,
    });

    this.fallbackEngine = createFallbackEngine({
      settings,
      taskId: this.currentTaskId!,
      sessionId: this.currentSessionId ?? undefined,
      originalModel: this.currentModelId || 'unknown',
      originalProvider: this.currentProvider || 'unknown',
    });

    // Wire up engine events to adapter events
    this.fallbackEngine.on('fallback:start', (data) => {
      console.log('[OpenCode Adapter] Fallback started:', data);
      this.emit('fallback:started', data);
    });

    this.fallbackEngine.on('fallback:complete', (data) => {
      console.log('[OpenCode Adapter] Fallback completed:', data);
      this.emit('fallback:completed', data);
    });

    this.fallbackEngine.on('fallback:error', (data) => {
      console.log('[OpenCode Adapter] Fallback error:', data);
      this.emit('fallback:failed', data);
    });
  }

  /**
   * Handle a rate limit error by retrying with backoff, then falling back
   *
   * @param errorMessage - The error message that was detected
   * @returns True if retry or fallback was initiated, false if not possible
   *
   * AIDEV-NOTE: Retry first (preserves session), fallback only as last resort
   * AIDEV-WARNING: Retry uses same model+session, fallback switches model
   */
  private async handleRateLimitWithFallback(errorMessage: string): Promise<boolean> {
    // ================================================================
    // PHASE 1: Try retrying with same model (preserves full context)
    // ================================================================
    if (this.retryManager.shouldRetry()) {
      const delay = this.retryManager.getNextDelay();
      const attempt = this.retryManager.getCurrentAttempt() + 1;
      const remaining = this.retryManager.getRemainingRetries();

      console.log(`[OpenCode Adapter] Rate limit retry ${attempt}/${attempt + remaining - 1}, waiting ${delay}ms`);

      this.emit('progress', {
        stage: 'retry-waiting',
        message: `Rate limit. Retentativa ${attempt} em ${Math.round(delay / 1000)}s...`,
      });
      this.emit('debug', {
        type: 'retry_waiting',
        message: `Rate limit retry: waiting ${delay}ms before attempt ${attempt}`,
        data: { attempt, delayMs: delay, remaining },
      });

      // AIDEV-WARNING: Finalize token accumulator source BEFORE killing PTY
      this.tokenAccumulator.finalizeCurrentSource();

      // Kill current PTY (it's stuck on rate limit)
      this.pendingFallbackRestart = true;
      if (this.ptyProcess) {
        try { this.ptyProcess.kill(); } catch (err) {
          console.warn('[OpenCode Adapter] Error killing PTY for retry:', err);
        }
        this.ptyProcess = null;
      }

      // Wait with backoff delay
      await new Promise<void>((resolve) => {
        this.retryWaitTimer = setTimeout(() => {
          this.retryWaitTimer = null;
          resolve();
        }, delay);
      });

      // Record attempt after waiting
      this.retryManager.recordAttempt();

      // Resume session with SAME model (preserves full context!)
      this.emit('progress', {
        stage: 'retry-attempting',
        message: `Retentativa ${attempt}...`,
      });

      try {
        this.streamParser.reset();
        this.hasCompleted = false;
        this.hasReceivedFirstTool = false;
        // AIDEV-NOTE: Update token source to 'retry' for tracking
        this.currentSource = 'retry';
        this.currentStepNumber = 0;
        await this.spawnSessionResumption(
          `A requisição anterior falhou por limite de taxa. Continue a tarefa de onde parou. Não repita ações já realizadas.`
        );
        return true;
      } catch (error) {
        console.error('[OpenCode Adapter] Retry session resumption failed:', error);
        // Fall through to fallback
      }
    }

    // ================================================================
    // PHASE 2: Retries exhausted - fall back to alternate model
    // ================================================================
    if (!this.fallbackEngine) {
      console.log('[OpenCode Adapter] No fallback engine available and retries exhausted');
      return false;
    }

    console.log('[OpenCode Adapter] Retries exhausted, attempting model fallback...');
    this.emit('progress', {
      stage: 'retry-exhausted',
      message: 'Retries esgotados. Acionando fallback...',
    });

    try {
      const result: FallbackHandleResult = await this.fallbackEngine.handleError(
        errorMessage,
        this.messages,
        this.currentPrompt || undefined
      );

      if (!result.shouldFallback) {
        console.log('[OpenCode Adapter] Fallback not possible:', {
          errorType: result.errorType,
        });
        return false;
      }

      console.log('[OpenCode Adapter] Fallback decision:', {
        shouldFallback: result.shouldFallback,
        fallbackModel: result.fallbackModel,
        contextMethod: result.contextMethod,
      });

      await this.restartWithFallback(
        {
          id: result.fallbackModel!,
          provider: result.fallbackProvider!,
        },
        result.context!
      );

      return true;
    } catch (error) {
      console.error('[OpenCode Adapter] Fallback handling failed:', error);
      this.emit('fallback:failed', {
        error: error instanceof Error ? error.message : String(error),
        phase: 'execution',
      });
      return false;
    }
  }

  /**
   * Restart the task with a fallback model and continuation context
   *
   * @param fallbackModel - The model to use for continuation
   * @param context - Generated context describing work done so far
   *
   * AIDEV-NOTE: Kills current process and starts new one with fallback model
   * AIDEV-WARNING: Task state is preserved but execution restarts
   */
  private async restartWithFallback(
    fallbackModel: { id: string; provider: string },
    context: string
  ): Promise<void> {
    console.log('[OpenCode Adapter] Restarting with fallback model:', fallbackModel);

    // AIDEV-WARNING: Finalize token accumulator source BEFORE killing PTY
    this.tokenAccumulator.finalizeCurrentSource();

    // AIDEV-WARNING: Set pendingFallbackRestart BEFORE killing PTY so the
    // original PTY's onExit handler knows to ignore the exit event
    this.pendingFallbackRestart = true;

    // Kill current PTY process
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch (err) {
        console.warn('[OpenCode Adapter] Error killing PTY for fallback:', err);
      }
      this.ptyProcess = null;
    }

    // Mark as fallback execution
    this.isFallbackExecution = true;
    // AIDEV-NOTE: Update token source to 'fallback' for tracking
    this.currentSource = 'fallback';
    this.currentStepNumber = 0;

    // Create continuation prompt with context
    // AIDEV-NOTE: Prompt must be single-line to avoid shell argument breaking on Windows
    const contextOneLine = context.replace(/[\r\n]+/g, ' ').trim();
    const originalPrompt = (this.currentPrompt || 'N/A').replace(/[\r\n]+/g, ' ').trim();
    const continuationPrompt = `[CONTINUACAO DE TAREFA - FALLBACK AUTOMATICO] A tarefa anterior foi interrompida por limite de requisicoes do modelo. Contexto: ${contextOneLine} -- Tarefa original: ${originalPrompt} -- Continue a tarefa de onde parou.`;

    // Reset adapter state for new execution
    this.streamParser.reset();
    this.hasCompleted = false;
    this.completionEnforcer.resetToolsUsed();
    this.hasReceivedFirstTool = false;

    // Start new task with fallback model
    // Note: We use the existing session ID to preserve context
    const config: TaskConfig = {
      prompt: continuationPrompt,
      sessionId: this.currentSessionId || undefined,
      workingDirectory: this.lastWorkingDirectory,
      taskId: this.currentTaskId || undefined,
    };

    // Emit progress to notify UI of fallback
    this.emit('progress', {
      stage: 'fallback',
      message: `Switching to ${getModelDisplayName(fallbackModel.id)}...`,
      modelName: getModelDisplayName(fallbackModel.id),
    });

    // Build CLI args for the fallback model
    // We need to override the model selection temporarily
    const originalModelId = this.currentModelId;
    const originalProvider = this.currentProvider;

    try {
      // Update current model to fallback
      this.currentModelId = fallbackModel.id;
      this.currentProvider = fallbackModel.provider;

      // Build and execute the CLI
      const cliArgs = await this.buildCliArgs(config);
      const { command, args: baseArgs } = getOpenCodeCliPath();
      const allArgs = [...baseArgs, ...cliArgs];

      // Override model in args for fallback
      const modelArgIndex = allArgs.indexOf('--model');
      if (modelArgIndex !== -1 && modelArgIndex + 1 < allArgs.length) {
        // Format: provider/model for openrouter, or just model ID
        if (fallbackModel.provider === 'openrouter') {
          allArgs[modelArgIndex + 1] = `openrouter/${fallbackModel.id}`;
        } else {
          allArgs[modelArgIndex + 1] = `${fallbackModel.provider}/${fallbackModel.id}`;
        }
      } else {
        // Add model argument
        if (fallbackModel.provider === 'openrouter') {
          allArgs.push('--model', `openrouter/${fallbackModel.id}`);
        } else {
          allArgs.push('--model', `${fallbackModel.provider}/${fallbackModel.id}`);
        }
      }

      console.log('[OpenCode Adapter] Fallback CLI command:', command, allArgs.join(' '));

      // Build environment and spawn new PTY
      const env = await this.buildEnvironment();
      const safeCwd = config.workingDirectory || app.getPath('temp');
      const fullCommand = this.buildShellCommand(command, allArgs);
      const shellCmd = this.getPlatformShell();
      const shellArgs = this.getShellArgs(fullCommand);

      this.ptyProcess = pty.spawn(shellCmd, shellArgs, {
        name: 'xterm-256color',
        cols: 30000,
        rows: 30,
        cwd: safeCwd,
        env: env as { [key: string]: string },
      });

      // Setup PTY event handlers
      this.ptyProcess.onData((data: string) => {
        const cleanData = data
          .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
          .replace(/\x1B\][^\x07]*\x07/g, '')
          .replace(/\x1B\][^\x1B]*\x1B\\/g, '');
        if (cleanData.trim()) {
          const truncated = cleanData.substring(0, 500) + (cleanData.length > 500 ? '...' : '');
          console.log('[OpenCode CLI stdout (fallback)]:', truncated);
          this.emit('debug', { type: 'stdout', message: cleanData });
          this.streamParser.feed(cleanData);
        }
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        // Log fallback result
        if (this.fallbackEngine) {
          const success = exitCode === 0;
          this.fallbackEngine.logResult(success);
        }
        console.log('[OpenCode Adapter] Flushing stream parser before process exit');
        this.emit('debug', {
          type: 'process_exit',
          message: 'Flushing stream parser before process exit',
          data: { exit_code: exitCode, flushed_on_exit: true, path: 'fallback' },
        });
        this.streamParser.flush();
        this.handleProcessExit(exitCode);
      });

      console.log('[OpenCode Adapter] Fallback PTY spawned with PID:', this.ptyProcess.pid);
    } catch (error) {
      // Restore original model on failure
      this.pendingFallbackRestart = false;
      this.currentModelId = originalModelId;
      this.currentProvider = originalProvider;
      throw error;
    }
  }

  /**
   * Start a new task with OpenCode CLI
   */
  async startTask(config: TaskConfig): Promise<Task> {
    // Check if adapter has been disposed
    if (this.isDisposed) {
      throw new Error('Adapter has been disposed and cannot start new tasks');
    }

    // Check if OpenCode CLI is installed before attempting to start
    const cliInstalled = await isOpenCodeCliInstalled();
    if (!cliInstalled) {
      throw new OpenCodeCliNotFoundError();
    }

    // ================================================================
    // TASK 25: Server-side authorization gate (FASE 5)
    // ================================================================
    // AIDEV-SECURITY: Verificar autorização com o servidor antes de executar task
    // O servidor valida plano ativo e limites mensais
    try {
      const session = await authClient.getSession();
      if (session?.data) {
        const sessionData = session.data as { session?: { token?: string }; accessToken?: string };
        const token = sessionData.session?.token || sessionData.accessToken;

        if (token) {
          // Chamar endpoint de autorização no Worker
          const authResponse = await fetch(`${WORKER_URL}/api/task/authorize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              taskId: config.taskId || 'unknown',
              estimatedTokens: 50000, // Estimativa padrão
            }),
          });

          const authData = await authResponse.json();

          if (!authResponse.ok || !authData.authorized) {
            // Emitir evento de autorização negada para o renderer
            this.emit('error', new Error(
              authData.error === 'Monthly limit exceeded'
                ? 'Limite mensal de tarefas excedido. Faça upgrade do seu plano.'
                : authData.error === 'License expired'
                ? 'Sua licença expirou. Renove para continuar usando.'
                : authData.error || 'Não autorizado a executar tarefas.'
            ));
            return {
              id: config.taskId || this.generateTaskId(),
              prompt: config.prompt,
              status: 'failed',
              messages: [],
              createdAt: new Date().toISOString(),
              startedAt: new Date().toISOString(),
            };
          }

          console.log('[OpenCode Adapter] Task authorized:', {
            plan: authData.plan,
            remaining: authData.remaining,
          });
        }
      }
    } catch (authError) {
      // Se falhar a verificação de auth (offline ou erro de rede),
      // ainda permitimos executar - o servidor vai registrar uso
      // e bloqueia se limite for excedido na próxima verificação
      console.warn('[OpenCode Adapter] Task authorization check failed (allowing execution):', authError);
    }

    const taskId = config.taskId || this.generateTaskId();
    this.currentTaskId = taskId;
    this.currentSessionId = null;
    this.messages = [];
    this.streamParser.reset();
    this.hasCompleted = false;
    this.wasInterrupted = false;
    this.completionEnforcer.reset();
    this.lastWorkingDirectory = config.workingDirectory;
    this.hasReceivedFirstTool = false;
    // Store original prompt for fallback context
    this.currentPrompt = config.prompt;

    // ================================================================
    // TOKEN TRACKING: Reset for new task
    // ================================================================
    // AIDEV-WARNING: Must reset BEFORE fallback state to ensure clean accumulator
    this.tokenAccumulator.reset();
    this.currentSource = 'primary';
    this.currentStepNumber = 0;
    this.costGuard = new CostGuard({
      maxCostUsd: DEFAULT_COST_LIMITS.free, // TODO: Use plan-based limit when billing is implemented
      onLimitReached: (accumulated, max) => {
        console.log(`[OpenCode Adapter] Cost limit reached: $${accumulated.toFixed(4)} >= $${max.toFixed(2)}`);
        this.emit('token-usage:limit-reached', { accumulated, max });
        // Cancel the task when cost limit is reached
        this.cancelTask().catch((err) => {
          console.error('[OpenCode Adapter] Failed to cancel task on cost limit:', err);
        });
      },
      onWarning: (accumulated, max) => {
        console.log(`[OpenCode Adapter] Cost warning: $${accumulated.toFixed(4)} approaching $${max.toFixed(2)}`);
        this.emit('token-usage:warning', { accumulated, max });
      },
    });

    // Reset fallback state
    this.isFallbackExecution = false;
    this.pendingFallbackRestart = false;
    this.retryManager.reset();
    // Clear any existing waiting transition timer
    if (this.waitingTransitionTimer) {
      clearTimeout(this.waitingTransitionTimer);
      this.waitingTransitionTimer = null;
    }

    // Start the log watcher to detect errors that aren't output as JSON
    if (this.logWatcher) {
      await this.logWatcher.start();
    }

    // ================================================================
    // FALLBACK SYSTEM: Initialize FallbackEngine for this task
    // ================================================================
    // AIDEV-NOTE: Engine handles rate limit errors with automatic model switching
    // AIDEV-WARNING: Dispose old engine before creating new one
    if (this.fallbackEngine) {
      this.fallbackEngine.dispose();
      this.fallbackEngine = null;
    }

    // Run Node.js diagnostics to help troubleshoot MCP server issues
    // This is non-blocking and just logs information
    await this.runNodeDiagnostics();

    // Sync API keys to OpenCode CLI's auth.json (for DeepSeek, Z.AI support)
    await syncApiKeysToOpenCodeAuth();

    // For Azure Foundry with Entra ID auth, get the token first so we can include it in config
    let azureFoundryToken: string | undefined;
    const activeModel = getActiveProviderModel();
    const selectedModel = activeModel || getSelectedModel();

    // Store current model and provider for fallback tracking
    this.currentModelId = selectedModel?.model || null;
    this.currentProvider = selectedModel?.provider || null;

    // Initialize FallbackEngine after we know the current model
    await this.initFallbackEngine();

    // TODO: Remove legacy azureFoundryConfig check in v0.4.0
    const azureFoundryConfig = getAzureFoundryConfig();

    // Check if Azure Foundry is configured via new provider settings
    const azureFoundryProvider = getConnectedProvider('azure-foundry');
    const azureFoundryCredentials = azureFoundryProvider?.credentials as AzureFoundryCredentials | undefined;

    // Determine auth type from new settings or legacy config
    const isAzureFoundryEntraId =
      (selectedModel?.provider === 'azure-foundry' && azureFoundryCredentials?.authMethod === 'entra-id') ||
      (selectedModel?.provider === 'azure-foundry' && azureFoundryConfig?.authType === 'entra-id');

    if (isAzureFoundryEntraId) {
      const tokenResult = await getAzureEntraToken();
      if (!tokenResult.success) {
        console.error('[OpenCode CLI] Failed to get Azure Entra ID token:', tokenResult.error);
        throw new Error(tokenResult.error);
      }
      azureFoundryToken = tokenResult.token;
      console.log('[OpenCode CLI] Obtained Azure Entra ID token for config');
    }

    // Generate OpenCode config file with MCP settings and agent
    console.log('[OpenCode CLI] Generating OpenCode config with MCP settings and agent...');
    const configPath = await generateOpenCodeConfig(azureFoundryToken);
    console.log('[OpenCode CLI] Config generated at:', configPath);

    const cliArgs = await this.buildCliArgs(config);

    // Get the bundled CLI path
    const { command, args: baseArgs } = getOpenCodeCliPath();
    const startMsg = `Starting: ${command} ${[...baseArgs, ...cliArgs].join(' ')}`;
    console.log('[OpenCode CLI]', startMsg);
    this.emit('debug', { type: 'info', message: startMsg });

    // Build environment with API keys
    const env = await this.buildEnvironment();

    const allArgs = [...baseArgs, ...cliArgs];
    const cmdMsg = `Command: ${command}`;
    const argsMsg = `Args: ${allArgs.join(' ')}`;
    // Use temp directory as default cwd to avoid TCC permission prompts.
    // Home directory (~/) triggers TCC when the CLI scans for projects/configs
    // because it lists Desktop, Documents, etc.
    const safeCwd = config.workingDirectory || app.getPath('temp');
    const cwdMsg = `Working directory: ${safeCwd}`;

    // Create a minimal package.json in the working directory so OpenCode finds it there
    // and stops searching upward. This prevents EPERM errors when OpenCode traverses
    // up to protected directories like C:\Program Files\Openwork\resources\
    // This is Windows-specific since the EPERM issue occurs with protected Program Files directories.
    if (app.isPackaged && process.platform === 'win32') {
      const dummyPackageJson = path.join(safeCwd, 'package.json');
      if (!fs.existsSync(dummyPackageJson)) {
        try {
          fs.writeFileSync(dummyPackageJson, JSON.stringify({ name: 'opencode-workspace', private: true }, null, 2));
          console.log('[OpenCode CLI] Created workspace package.json at:', dummyPackageJson);
        } catch (err) {
          console.warn('[OpenCode CLI] Could not create workspace package.json:', err);
        }
      }
    }

    console.log('[OpenCode CLI]', cmdMsg);
    console.log('[OpenCode CLI]', argsMsg);
    console.log('[OpenCode CLI]', cwdMsg);

    this.emit('debug', { type: 'info', message: cmdMsg });
    this.emit('debug', { type: 'info', message: argsMsg, data: { args: allArgs } });
    this.emit('debug', { type: 'info', message: cwdMsg });

    // Always use PTY for proper terminal emulation
    // We spawn via shell because posix_spawnp doesn't interpret shebangs
    {
      const fullCommand = this.buildShellCommand(command, allArgs);

      const shellCmdMsg = `Full shell command: ${fullCommand}`;
      console.log('[OpenCode CLI]', shellCmdMsg);
      this.emit('debug', { type: 'info', message: shellCmdMsg });

      // Use platform-appropriate shell
      const shellCmd = this.getPlatformShell();
      const shellArgs = this.getShellArgs(fullCommand);
      const shellMsg = `Using shell: ${shellCmd} ${shellArgs.join(' ')}`;
      console.log('[OpenCode CLI]', shellMsg);
      this.emit('debug', { type: 'info', message: shellMsg });

      this.ptyProcess = pty.spawn(shellCmd, shellArgs, {
        name: 'xterm-256color',
        cols: 30000,
        rows: 30,
        cwd: safeCwd,
        env: env as { [key: string]: string },
      });
      const pidMsg = `PTY Process PID: ${this.ptyProcess.pid}`;
      console.log('[OpenCode CLI]', pidMsg);
      this.emit('debug', { type: 'info', message: pidMsg });

      // Emit 'loading' stage after PTY spawn
      this.emit('progress', { stage: 'loading', message: 'Loading agent...' });

      // Handle PTY data (combines stdout/stderr)
      this.ptyProcess.onData((data: string) => {
        // Filter out ANSI escape codes and control characters for cleaner parsing
        // Enhanced to handle Windows PowerShell sequences (cursor visibility, window titles)
        const cleanData = data
          .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')  // CSI sequences (added ? for DEC modes like cursor hide)
          .replace(/\x1B\][^\x07]*\x07/g, '')       // OSC sequences with BEL terminator (window titles)
          .replace(/\x1B\][^\x1B]*\x1B\\/g, '');    // OSC sequences with ST terminator
        if (cleanData.trim()) {
          // Truncate for console.log to avoid flooding terminal
          const truncated = cleanData.substring(0, 500) + (cleanData.length > 500 ? '...' : '');
          console.log('[OpenCode CLI stdout]:', truncated);
          // Send full data to debug panel
          this.emit('debug', { type: 'stdout', message: cleanData });

          this.streamParser.feed(cleanData);
        }
      });

      // Handle PTY exit
      this.ptyProcess.onExit(({ exitCode, signal }) => {
        const exitMsg = `PTY Process exited with code: ${exitCode}, signal: ${signal}`;
        console.log('[OpenCode CLI]', exitMsg);
        this.emit('debug', { type: 'exit', message: exitMsg, data: { exitCode, signal } });
        console.log('[OpenCode Adapter] Flushing stream parser before process exit');
        this.emit('debug', {
          type: 'process_exit',
          message: 'Flushing stream parser before process exit',
          data: { exit_code: exitCode, signal, flushed_on_exit: true, path: 'normal' },
        });
        this.streamParser.flush();
        this.handleProcessExit(exitCode);
      });
    }

    return {
      id: taskId,
      prompt: config.prompt,
      status: 'running',
      messages: [],
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string, prompt: string): Promise<Task> {
    return this.startTask({
      prompt,
      sessionId,
    });
  }

  /**
   * Send user response for permission/question
   * Note: This requires the PTY to be active
   */
  async sendResponse(response: string): Promise<void> {
    if (!this.ptyProcess) {
      throw new Error('No active process');
    }

    this.ptyProcess.write(response + '\n');
    console.log('[OpenCode CLI] Response sent via PTY');
  }

  /**
   * Cancel the current task (hard kill)
   */
  async cancelTask(): Promise<void> {
    // AIDEV-WARNING: Must clear retryWaitTimer BEFORE killing PTY to prevent
    // stale timer from firing spawnSessionResumption() after cancel
    if (this.retryWaitTimer) {
      clearTimeout(this.retryWaitTimer);
      this.retryWaitTimer = null;
    }

    // AIDEV-WARNING: Persist partial tokens BEFORE killing PTY
    this.persistTokenData();

    if (this.ptyProcess) {
      // Kill the PTY process
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }

  /**
   * Interrupt the current task (graceful Ctrl+C)
   * Sends SIGINT to allow the CLI to stop gracefully and wait for next input.
   * Unlike cancelTask(), this doesn't kill the process - it just interrupts the current operation.
   */
  async interruptTask(): Promise<void> {
    if (!this.ptyProcess) {
      console.log('[OpenCode CLI] No active process to interrupt');
      return;
    }

    // Mark as interrupted so we can handle the exit appropriately
    this.wasInterrupted = true;

    // AIDEV-WARNING: Persist partial tokens on interrupt
    this.persistTokenData();

    // Send Ctrl+C (ASCII 0x03) to the PTY to interrupt current operation
    this.ptyProcess.write('\x03');
    console.log('[OpenCode CLI] Sent Ctrl+C interrupt signal');

    // On Windows, batch files (.cmd) prompt "Terminate batch job (Y/N)?" after Ctrl+C.
    // We need to send "Y" to confirm termination, otherwise the process hangs.
    if (process.platform === 'win32') {
      setTimeout(() => {
        if (this.ptyProcess) {
          this.ptyProcess.write('Y\n');
          console.log('[OpenCode CLI] Sent Y to confirm batch termination');
        }
      }, 100);
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get the current task ID
   */
  getTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * Check if the adapter has been disposed
   */
  isAdapterDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Dispose the adapter and clean up all resources
   * Called when task completes, is cancelled, or on app quit
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    console.log(`[OpenCode Adapter] Disposing adapter for task ${this.currentTaskId}`);
    this.isDisposed = true;

    // Stop the log watcher
    if (this.logWatcher) {
      this.logWatcher.stop().catch((err) => {
        console.warn('[OpenCode Adapter] Error stopping log watcher:', err);
      });
    }

    // Kill PTY process if running
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch (error) {
        console.error('[OpenCode Adapter] Error killing PTY process:', error);
      }
      this.ptyProcess = null;
    }

    // ================================================================
    // TOKEN TRACKING: Persist partial tokens BEFORE clearing taskId
    // ================================================================
    // AIDEV-WARNING: Must persist BEFORE clearing currentTaskId — otherwise saves with null taskId
    if (!this.tokenAccumulator.isEmpty()) {
      this.persistTokenData();
    }

    // Clear state
    this.currentSessionId = null;
    this.currentTaskId = null;
    this.messages = [];
    this.hasCompleted = true;
    this.currentModelId = null;
    this.currentProvider = null;
    this.hasReceivedFirstTool = false;
    this.currentPrompt = null;
    this.isFallbackExecution = false;
    this.pendingFallbackRestart = false;

    // Clear retry wait timer
    if (this.retryWaitTimer) {
      clearTimeout(this.retryWaitTimer);
      this.retryWaitTimer = null;
    }
    this.retryManager.dispose();

    // Clear waiting transition timer
    if (this.waitingTransitionTimer) {
      clearTimeout(this.waitingTransitionTimer);
      this.waitingTransitionTimer = null;
    }

    // ================================================================
    // TOKEN TRACKING: Persist partial tokens on dispose if any
    // ================================================================
    // FALLBACK SYSTEM: Dispose FallbackEngine
    // ================================================================
    // AIDEV-NOTE: Clean up fallback engine resources
    if (this.fallbackEngine) {
      this.fallbackEngine.dispose();
      this.fallbackEngine = null;
    }

    // Reset stream parser
    this.streamParser.reset();

    // Remove all listeners
    this.removeAllListeners();

    console.log('[OpenCode Adapter] Adapter disposed');
  }

  /**
   * Run diagnostic checks on bundled Node.js to help troubleshoot MCP server failures.
   * This logs detailed information about the Node.js setup without blocking task execution.
   */
  private async runNodeDiagnostics(): Promise<void> {
    const bundledPaths = getBundledNodePaths();

    console.log('[OpenCode Diagnostics] === Node.js Environment Check ===');

    if (!bundledPaths) {
      console.log('[OpenCode Diagnostics] Development mode - using system Node.js');
      return;
    }

    // Check if bundled files exist
    const fs = await import('fs');
    const nodeExists = fs.existsSync(bundledPaths.nodePath);
    const npxExists = fs.existsSync(bundledPaths.npxPath);
    const npmExists = fs.existsSync(bundledPaths.npmPath);

    console.log('[OpenCode Diagnostics] Bundled Node.js paths:');
    console.log(`  node: ${bundledPaths.nodePath} (exists: ${nodeExists})`);
    console.log(`  npx:  ${bundledPaths.npxPath} (exists: ${npxExists})`);
    console.log(`  npm:  ${bundledPaths.npmPath} (exists: ${npmExists})`);
    console.log(`  binDir: ${bundledPaths.binDir}`);

    // Try to run node --version to verify bundled Node.js works
    // We test node.exe directly because on Windows, .cmd files require shell execution
    // and MCP servers now use node.exe + cli.mjs to bypass .cmd issues
    if (nodeExists) {
      console.log(`[OpenCode Diagnostics] Testing node execution: ${bundledPaths.nodePath} --version`);

      try {
        const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          const child = spawn(bundledPaths.nodePath, ['--version'], {
            env: process.env,
            timeout: 10000,
            shell: false, // node.exe is a real executable, no shell needed
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => { stdout += data.toString(); });
          child.stderr?.on('data', (data) => { stderr += data.toString(); });

          child.on('error', reject);
          child.on('close', (code) => {
            if (code === 0) {
              resolve({ stdout, stderr });
            } else {
              reject(new Error(`Process exited with code ${code}`));
            }
          });
        });
        console.log(`[OpenCode Diagnostics] node --version SUCCESS: ${result.stdout.trim()}`);
      } catch (error) {
        const err = error as Error & { code?: string; killed?: boolean };
        console.error('[OpenCode Diagnostics] node --version FAILED:', err.message);
        console.error(`[OpenCode Diagnostics]   Error code: ${err.code || 'none'}`);
        console.error(`[OpenCode Diagnostics]   This WILL cause MCP server startup failures!`);

        // Emit debug event so it shows in UI
        this.emit('debug', {
          type: 'error',
          message: `Bundled node test failed: ${err.message}. MCP servers will not start correctly.`,
          data: { error: err.message, nodePath: bundledPaths.nodePath }
        });
      }
    } else {
      console.error('[OpenCode Diagnostics] Bundled node not found - MCP servers will likely fail!');
      this.emit('debug', {
        type: 'error',
        message: 'Bundled node.exe not found. MCP servers will not start.',
        data: { expectedPath: bundledPaths.nodePath }
      });
    }

    // Check for system Node.js as fallback info
    try {
      const { execSync } = await import('child_process');
      const systemNode = execSync('where node', { encoding: 'utf8', timeout: 5000 }).trim();
      console.log(`[OpenCode Diagnostics] System Node.js found: ${systemNode.split('\n')[0]}`);
    } catch {
      console.log('[OpenCode Diagnostics] System Node.js: NOT FOUND (this is OK if bundled Node works)');
    }

    console.log('[OpenCode Diagnostics] === End Environment Check ===');
  }

  /**
   * Build environment variables with all API keys
   */
  private async buildEnvironment(): Promise<NodeJS.ProcessEnv> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
    };

    if (app.isPackaged) {
      // Run the bundled CLI with Electron acting as Node (no system Node required).
      env.ELECTRON_RUN_AS_NODE = '1';

      // Log bundled Node.js configuration
      logBundledNodeInfo();

      // Add bundled Node.js to PATH (highest priority)
      const bundledNode = getBundledNodePaths();
      if (bundledNode) {
        // Prepend bundled Node.js bin directory to PATH
        const delimiter = process.platform === 'win32' ? ';' : ':';
        const pathSource = env.PATH ? 'PATH' : (env.Path ? 'Path' : 'none');
        const existingPath = env.PATH ?? env.Path ?? '';
        console.log(`[OpenCode CLI] Existing PATH source: ${pathSource} (${existingPath ? 'present' : 'missing'})`);
        const combinedPath = existingPath
          ? `${bundledNode.binDir}${delimiter}${existingPath}`
          : bundledNode.binDir;
        env.PATH = combinedPath;
        // On Windows, PATH is often stored as "Path" (case-insensitive). Keep both in sync.
        if (process.platform === 'win32') {
          env.Path = combinedPath;
        }
        // Also expose as NODE_BIN_PATH so agent can use it in bash commands
        env.NODE_BIN_PATH = bundledNode.binDir;
        console.log('[OpenCode CLI] Added bundled Node.js to PATH:', bundledNode.binDir);

        // Log the full PATH for debugging (truncated to avoid excessive log size)
        const pathPreview = env.PATH.substring(0, 500) + (env.PATH.length > 500 ? '...' : '');
        console.log('[OpenCode CLI] Full PATH (first 500 chars):', pathPreview);
      }

      // For packaged apps on macOS, also extend PATH to include common Node.js locations as fallback.
      // This avoids using login shell which triggers folder access permissions.
      if (process.platform === 'darwin') {
        env.PATH = getExtendedNodePath(env.PATH);
        console.log('[OpenCode CLI] Extended PATH for packaged app');
      }
    }

    // Load all API keys
    const apiKeys = await getAllApiKeys();

    if (apiKeys.anthropic) {
      env.ANTHROPIC_API_KEY = apiKeys.anthropic;
      console.log('[OpenCode CLI] Using Anthropic API key from settings');
    }
    const configuredOpenAiBaseUrl = getOpenAiBaseUrl().trim();
    if (apiKeys.openai) {
      env.OPENAI_API_KEY = apiKeys.openai;
      console.log('[OpenCode CLI] Using OpenAI API key from settings');

      if (configuredOpenAiBaseUrl) {
        env.OPENAI_BASE_URL = configuredOpenAiBaseUrl;
        console.log('[OpenCode CLI] Using OPENAI_BASE_URL override from settings');
      }
    }
    if (apiKeys.google) {
      env.GOOGLE_GENERATIVE_AI_API_KEY = apiKeys.google;
      console.log('[OpenCode CLI] Using Google API key from settings');
    }
    if (apiKeys.xai) {
      env.XAI_API_KEY = apiKeys.xai;
      console.log('[OpenCode CLI] Using xAI API key from settings');
    }
    if (apiKeys.deepseek) {
      env.DEEPSEEK_API_KEY = apiKeys.deepseek;
      console.log('[OpenCode CLI] Using DeepSeek API key from settings');
    }
    if (apiKeys.moonshot) {
      env.MOONSHOT_API_KEY = apiKeys.moonshot;
      console.log('[OpenCode CLI] Using Moonshot API key from settings');
    }
    if (apiKeys.zai) {
      env.ZAI_API_KEY = apiKeys.zai;
      console.log('[OpenCode CLI] Using Z.AI API key from settings');
    }
    if (apiKeys.openrouter) {
      env.OPENROUTER_API_KEY = apiKeys.openrouter;
      console.log('[OpenCode CLI] Using OpenRouter API key from settings');
    }
    if (apiKeys.litellm) {
      env.LITELLM_API_KEY = apiKeys.litellm;
      console.log('[OpenCode CLI] Using LiteLLM API key from settings');
    }
    if (apiKeys.minimax) {
      env.MINIMAX_API_KEY = apiKeys.minimax;
      console.log('[OpenCode CLI] Using MiniMax API key from settings');
    }

    // Set Bedrock credentials if configured
    const bedrockCredentials = getBedrockCredentials();
    if (bedrockCredentials) {
      if (bedrockCredentials.authType === 'accessKeys') {
        env.AWS_ACCESS_KEY_ID = bedrockCredentials.accessKeyId;
        env.AWS_SECRET_ACCESS_KEY = bedrockCredentials.secretAccessKey;
        if (bedrockCredentials.sessionToken) {
          env.AWS_SESSION_TOKEN = bedrockCredentials.sessionToken;
        }
        console.log('[OpenCode CLI] Using Bedrock Access Key credentials');
      } else if (bedrockCredentials.authType === 'profile') {
        env.AWS_PROFILE = bedrockCredentials.profileName;
        console.log('[OpenCode CLI] Using Bedrock AWS Profile:', bedrockCredentials.profileName);
      }
      if (bedrockCredentials.region) {
        env.AWS_REGION = bedrockCredentials.region;
        console.log('[OpenCode CLI] Using Bedrock region:', bedrockCredentials.region);
      }
    }

    // Set Ollama host if configured (check new settings first, then legacy)
    const activeModel = getActiveProviderModel();
    const selectedModel = getSelectedModel();
    if (activeModel?.provider === 'ollama' && activeModel.baseUrl) {
      env.OLLAMA_HOST = activeModel.baseUrl;
      console.log('[OpenCode CLI] Using Ollama host from provider settings:', activeModel.baseUrl);
    } else if (selectedModel?.provider === 'ollama' && selectedModel.baseUrl) {
      env.OLLAMA_HOST = selectedModel.baseUrl;
      console.log('[OpenCode CLI] Using Ollama host from legacy settings:', selectedModel.baseUrl);
    }

    // Set LiteLLM base URL if configured (for debugging/logging purposes)
    if (activeModel?.provider === 'litellm' && activeModel.baseUrl) {
      console.log('[OpenCode CLI] LiteLLM active with base URL:', activeModel.baseUrl);
    }

    // Log config environment variable
    console.log('[OpenCode CLI] OPENCODE_CONFIG in env:', process.env.OPENCODE_CONFIG);
    if (process.env.OPENCODE_CONFIG) {
      env.OPENCODE_CONFIG = process.env.OPENCODE_CONFIG;
      console.log('[OpenCode CLI] Passing OPENCODE_CONFIG to subprocess:', env.OPENCODE_CONFIG);
    }

    // Pass task ID to environment for task-scoped page naming in parallel execution
    if (this.currentTaskId) {
      env.ACCOMPLISH_TASK_ID = this.currentTaskId;
      console.log('[OpenCode CLI] Task ID in environment:', this.currentTaskId);
    }

    this.emit('debug', { type: 'info', message: 'Environment configured with API keys' });

    return env;
  }

  private async buildCliArgs(config: TaskConfig): Promise<string[]> {
    // Try new provider settings first, fall back to legacy settings
    const activeModel = getActiveProviderModel();
    const selectedModel = activeModel || getSelectedModel();

    // Store the model ID for display name in progress events
    this.currentModelId = selectedModel?.model || null;

    // OpenCode CLI uses: opencode run "message" --format json
    const args = [
      'run',
      config.prompt,
      '--format', 'json',
    ];

    // Add model selection if specified
    if (selectedModel?.model) {
      if (selectedModel.provider === 'zai') {
        // Z.AI Coding Plan uses 'zai-coding-plan' provider in OpenCode CLI
        const modelId = selectedModel.model.split('/').pop();
        args.push('--model', `zai-coding-plan/${modelId}`);
      } else if (selectedModel.provider === 'deepseek') {
        // DeepSeek uses 'deepseek' provider in OpenCode CLI
        const modelId = selectedModel.model.split('/').pop();
        args.push('--model', `deepseek/${modelId}`);
      } else if (selectedModel.provider === 'openrouter') {
        // OpenRouter models use format: openrouter/provider/model
        // The fullId is already in the correct format (e.g., openrouter/anthropic/claude-opus-4-5)
        args.push('--model', selectedModel.model);
      } else if (selectedModel.provider === 'ollama') {
        // Ollama models use format: ollama/model-name
        const modelId = selectedModel.model.replace(/^ollama\//, '');
        args.push('--model', `ollama/${modelId}`);
      } else if (selectedModel.provider === 'litellm') {
        // LiteLLM models use format: litellm/model-name
        const modelId = selectedModel.model.replace(/^litellm\//, '');
        args.push('--model', `litellm/${modelId}`);
      } else {
        args.push('--model', selectedModel.model);
      }
    }

    // Resume session if specified
    if (config.sessionId) {
      args.push('--session', config.sessionId);
    }

    // Use the Accomplish agent for browser automation guidance
    args.push('--agent', ACCOMPLISH_AGENT_NAME);

    return args;
  }

  private setupStreamParsing(): void {
    this.streamParser.on('message', (message: OpenCodeMessage) => {
      this.handleMessage(message);
    });

    // Handle parse errors gracefully to prevent crashes from non-JSON output
    // PTY combines stdout/stderr, so shell banners, warnings, etc. may appear
    this.streamParser.on('error', (error: Error) => {
      // Log but don't crash - non-JSON lines are expected from PTY (shell banners, warnings, etc.)
      console.warn('[OpenCode Adapter] Stream parse warning:', error.message);
      this.emit('debug', { type: 'parse-warning', message: error.message });
    });
  }

  private handleMessage(message: OpenCodeMessage): void {
    console.log('[OpenCode Adapter] Handling message type:', message.type);

    switch (message.type) {
      // Step start event
      case 'step_start':
        this.currentSessionId = message.part.sessionID;
        // Emit 'connecting' stage with model display name
        const modelDisplayName = this.currentModelId
          ? getModelDisplayName(this.currentModelId)
          : 'AI';
        this.emit('progress', {
          stage: 'connecting',
          message: `Connecting to ${modelDisplayName}...`,
          modelName: modelDisplayName,
        });
        // Start timer to transition to 'waiting' stage after 500ms if no tool received
        if (this.waitingTransitionTimer) {
          clearTimeout(this.waitingTransitionTimer);
        }
        this.waitingTransitionTimer = setTimeout(() => {
          if (!this.hasReceivedFirstTool && !this.hasCompleted) {
            this.emit('progress', { stage: 'waiting', message: 'Waiting for response...' });
          }
        }, 500);
        break;

      // Text content event
      case 'text':
        if (!this.currentSessionId && message.part.sessionID) {
          this.currentSessionId = message.part.sessionID;
        }
        this.emit('message', message);

        if (message.part.text) {
          const taskMessage: TaskMessage = {
            id: this.generateMessageId(),
            type: 'assistant',
            content: message.part.text,
            timestamp: new Date().toISOString(),
          };
          this.messages.push(taskMessage);
        }
        break;

      // Tool call event
      case 'tool_call':
        const toolName = message.part.tool || 'unknown';
        const toolInput = message.part.input;

        console.log('[OpenCode Adapter] Tool call:', toolName);

        // Mark first tool received and cancel waiting transition timer
        if (!this.hasReceivedFirstTool) {
          this.hasReceivedFirstTool = true;
          if (this.waitingTransitionTimer) {
            clearTimeout(this.waitingTransitionTimer);
            this.waitingTransitionTimer = null;
          }
        }

        // ================================================================
        // FALLBACK SYSTEM: Store tool calls for context generation
        // ================================================================
        // AIDEV-NOTE: Tool calls are stored as messages for fallback context
        {
          const toolMessage: TaskMessage = {
            id: this.generateMessageId(),
            type: 'tool',
            content: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
            toolName: toolName,
            toolInput: toolInput,
            timestamp: new Date().toISOString(),
          };
          this.messages.push(toolMessage);
        }

        // Notify completion enforcer that tools were used in this invocation
        this.completionEnforcer.markToolsUsed();

        // COMPLETION ENFORCEMENT: Track complete_task tool calls
        // Tool name may be prefixed with MCP server name (e.g., "complete-task_complete_task")
        // so we use endsWith() for fuzzy matching
        if (toolName === 'complete_task' || toolName.endsWith('_complete_task')) {
          this.completionEnforcer.handleCompleteTaskDetection(toolInput);
        }

        // Detect todowrite tool calls and emit todo state
        // Built-in tool name is 'todowrite', MCP-prefixed would be '*_todowrite'
        if (toolName === 'todowrite' || toolName.endsWith('_todowrite')) {
          const input = toolInput as { todos?: TodoItem[] };
          // Only emit if we have actual todos (ignore empty arrays to prevent accidental clearing)
          if (input?.todos && Array.isArray(input.todos) && input.todos.length > 0) {
            this.emit('todo:update', input.todos);
            // Also update completion enforcer
            this.completionEnforcer.updateTodos(input.todos);
          }
        }

        this.emit('tool-use', toolName, toolInput);
        this.emit('progress', {
          stage: 'tool-use',
          message: `Using ${toolName}`,
        });

        // Check if this is AskUserQuestion (requires user input)
        if (toolName === 'AskUserQuestion') {
          this.handleAskUserQuestion(toolInput as AskUserQuestionInput);
        }
        break;

      // Tool use event - combined tool call and result from OpenCode CLI
      case 'tool_use':
        const toolUseMessage = message as import('@accomplish/shared').OpenCodeToolUseMessage;
        const toolUseName = toolUseMessage.part.tool || 'unknown';
        const toolUseInput = toolUseMessage.part.state?.input;
        const toolUseOutput = toolUseMessage.part.state?.output || '';

        // Mark first tool received and cancel waiting transition timer
        if (!this.hasReceivedFirstTool) {
          this.hasReceivedFirstTool = true;
          if (this.waitingTransitionTimer) {
            clearTimeout(this.waitingTransitionTimer);
            this.waitingTransitionTimer = null;
          }
        }

        // Notify completion enforcer that tools were used in this invocation
        this.completionEnforcer.markToolsUsed();

        // Track if complete_task was called (tool name may be prefixed with MCP server name)
        if (toolUseName === 'complete_task' || toolUseName.endsWith('_complete_task')) {
          this.completionEnforcer.handleCompleteTaskDetection(toolUseInput);
        }

        // Detect todowrite tool calls and emit todo state
        // Built-in tool name is 'todowrite', MCP-prefixed would be '*_todowrite'
        if (toolUseName === 'todowrite' || toolUseName.endsWith('_todowrite')) {
          const input = toolUseInput as { todos?: TodoItem[] };
          // Only emit if we have actual todos (ignore empty arrays to prevent accidental clearing)
          if (input?.todos && Array.isArray(input.todos) && input.todos.length > 0) {
            this.emit('todo:update', input.todos);
            // Also update completion enforcer
            this.completionEnforcer.updateTodos(input.todos);
          }
        }

        // For models that don't emit text messages (like Gemini), emit the tool description
        // as a thinking message so users can see what the AI is doing
        const toolDescription = (toolUseInput as { description?: string })?.description;
        if (toolDescription) {
          // Create a synthetic text message for the description
          const syntheticTextMessage: OpenCodeMessage = {
            type: 'text',
            timestamp: message.timestamp,
            sessionID: message.sessionID,
            part: {
              id: this.generateMessageId(),
              sessionID: toolUseMessage.part.sessionID,
              messageID: toolUseMessage.part.messageID,
              type: 'text',
              text: toolDescription,
            },
          } as import('@accomplish/shared').OpenCodeTextMessage;
          this.emit('message', syntheticTextMessage);
        }

        // Forward to handlers.ts for message processing (screenshots, etc.)
        this.emit('message', message);
        const toolUseStatus = toolUseMessage.part.state?.status;

        console.log('[OpenCode Adapter] Tool use:', toolUseName, 'status:', toolUseStatus);

        // Emit tool-use event for the call
        this.emit('tool-use', toolUseName, toolUseInput);
        this.emit('progress', {
          stage: 'tool-use',
          message: `Using ${toolUseName}`,
        });

        // If status is completed or error, also emit tool-result
        if (toolUseStatus === 'completed' || toolUseStatus === 'error') {
          this.emit('tool-result', toolUseOutput);
        }

        // Check if this is AskUserQuestion (requires user input)
        if (toolUseName === 'AskUserQuestion') {
          this.handleAskUserQuestion(toolUseInput as AskUserQuestionInput);
        }
        break;

      // Tool result event
      case 'tool_result':
        const toolOutput = message.part.output || '';
        console.log('[OpenCode Adapter] Tool result received, length:', toolOutput.length);
        this.emit('tool-result', toolOutput);
        break;

      // Step finish event
      // COMPLETION ENFORCEMENT: Previously emitted 'complete' immediately on stop/end_turn.
      // Now we delegate to CompletionEnforcer which may:
      // - Return 'complete' if complete_task was called and verified
      // - Return 'pending' if verification or continuation is needed (handled on process exit)
      // - Return 'continue' if more tool calls are expected (reason='tool_use')
      case 'step_finish':
        // ================================================================
        // TOKEN TRACKING: Capture tokens from step_finish if available
        // ================================================================
        // AIDEV-NOTE: OpenCode CLI MAY emit tokens/cost in step_finish (depends on CLI version)
        // AIDEV-WARNING: tokens field is often undefined — only accumulate when present
        {
          // AIDEV-NOTE: Capturar tokens de TODOS os step_finish, inclusive errors (L8)
          this.currentStepNumber++;
          const stepPart = message.part as { tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } }; cost?: number };
          if (stepPart.tokens || stepPart.cost) {
            this.tokenAccumulator.addStep({
              modelId: this.currentModelId || 'unknown',
              provider: this.currentProvider || 'unknown',
              source: this.currentSource,
              inputTokens: stepPart.tokens?.input,
              outputTokens: stepPart.tokens?.output,
              reasoningTokens: stepPart.tokens?.reasoning,
              cacheReadTokens: stepPart.tokens?.cache?.read,
              cacheWriteTokens: stepPart.tokens?.cache?.write,
              costUsd: stepPart.cost,
              stepNumber: this.currentStepNumber,
            });

            // Check cost guard
            if (stepPart.cost && this.costGuard) {
              this.costGuard.addCost(stepPart.cost);
            }

            // Emit real-time update to UI
            const totals = this.tokenAccumulator.getTotalTokens();
            this.emit('token-usage:update', {
              totalCost: this.tokenAccumulator.getTotalCost(),
              totalInput: totals.input,
              totalOutput: totals.output,
              stepCount: this.currentStepNumber,
            });
          }
        }

        if (message.part.reason === 'error') {
          if (!this.hasCompleted) {
            this.hasCompleted = true;
            this.emit('complete', {
              status: 'error',
              sessionId: this.currentSessionId || undefined,
              error: 'Task failed',
            });
          }
          break;
        }

        // Delegate to completion enforcer for stop/end_turn handling
        const action = this.completionEnforcer.handleStepFinish(message.part.reason);
        console.log(`[OpenCode Adapter] step_finish action: ${action}`);

        if (action === 'complete' && !this.hasCompleted) {
          this.hasCompleted = true;
          this.emit('complete', {
            status: 'success',
            sessionId: this.currentSessionId || undefined,
          });
        }
        // 'pending' and 'continue' - don't emit complete, let handleProcessExit handle it
        break;

      // Error event
      case 'error':
        this.hasCompleted = true;
        this.emit('complete', {
          status: 'error',
          sessionId: this.currentSessionId || undefined,
          error: message.error,
        });
        break;

      default:
        // Cast to unknown to safely access type property for logging
        const unknownMessage = message as unknown as { type: string };
        console.log('[OpenCode Adapter] Unknown message type:', unknownMessage.type);
    }
  }

  private handleAskUserQuestion(input: AskUserQuestionInput): void {
    const question = input.questions?.[0];
    if (!question) return;

    const permissionRequest: PermissionRequest = {
      id: this.generateRequestId(),
      taskId: this.currentTaskId || '',
      type: 'question',
      question: question.question,
      options: question.options?.map((o) => ({
        label: o.label,
        description: o.description,
      })),
      multiSelect: question.multiSelect,
      createdAt: new Date().toISOString(),
    };

    this.emit('permission-request', permissionRequest);
  }

  /**
   * Escape a shell argument for safe execution.
   */
  private escapeShellArg(arg: string): string {
    if (process.platform === 'win32') {
      // Replace newlines/carriage returns with spaces to prevent shell command breaking
      const sanitized = arg.replace(/[\r\n]+/g, ' ');
      if (sanitized.includes(' ') || sanitized.includes('"')) {
        return `"${sanitized.replace(/"/g, '""')}"`;
      }
      return sanitized;
    } else {
      const needsEscaping = ["'", ' ', '$', '`', '\\', '"', '\n'].some(c => arg.includes(c));
      if (needsEscaping) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }
  }

  /**
   * Build a shell command string with properly escaped arguments.
   * On Windows, prepends & call operator for paths with spaces.
   */
  private buildShellCommand(command: string, args: string[]): string {
    const escapedCommand = this.escapeShellArg(command);
    const escapedArgs = args.map(arg => this.escapeShellArg(arg));

    // On Windows, if the command path contains spaces (and is thus quoted),
    // we need to prepend & call operator so PowerShell executes it as a command
    // Without &, PowerShell treats "path with spaces" as a string literal
    if (process.platform === 'win32' && escapedCommand.startsWith('"')) {
      return ['&', escapedCommand, ...escapedArgs].join(' ');
    }

    return [escapedCommand, ...escapedArgs].join(' ');
  }

  /**
   * COMPLETION ENFORCEMENT: Process exit handler
   *
   * When the CLI process exits with code 0 and we haven't already completed:
   * 1. Delegate to CompletionEnforcer.handleProcessExit()
   * 2. Enforcer checks if verification or continuation is pending
   * 3. If so, it spawns a session resumption via callbacks
   * 4. If not, it calls onComplete() to emit the 'complete' event
   *
   * This allows the enforcer to chain multiple CLI invocations (verification,
   * continuation retries) while maintaining the same session context.
   */
  private handleProcessExit(code: number | null): void {
    // AIDEV-WARNING: If a fallback restart is pending, this exit is from the ORIGINAL PTY
    // being killed intentionally. We must ignore it to avoid marking the task as failed
    // while the fallback PTY is already running.
    if (this.pendingFallbackRestart) {
      console.log(`[OpenCode Adapter] handleProcessExit: IGNORING exit code=${code} - fallback restart is pending`);
      this.pendingFallbackRestart = false; // Clear for the fallback PTY's future exit
      return;
    }

    // Clean up PTY process reference
    this.ptyProcess = null;

    const completionStateBefore = CompletionFlowState[this.completionEnforcer.getState()];
    const successSignalSeen = this.completionEnforcer.wasSuccessSignalSeen();
    const continuationAttempts = this.completionEnforcer.getContinuationAttempts();
    console.log(`[OpenCode Adapter] handleProcessExit: code=${code}, hasCompleted=${this.hasCompleted}, isFallback=${this.isFallbackExecution}, successSignal=${successSignalSeen}`);
    this.emit('debug', {
      type: 'completion_exit_state',
      message: 'Completion state before process exit handling',
      data: {
        exit_code: code,
        completion_state_before_exit: completionStateBefore,
        success_signal_seen: successSignalSeen,
        continuation_attempts: continuationAttempts,
      },
    });

    // Handle interrupted tasks immediately (before completion enforcer)
    // This ensures user interrupts are respected regardless of completion state
    if (this.wasInterrupted && code === 0 && !this.hasCompleted) {
      console.log('[OpenCode CLI] Task was interrupted by user');
      this.hasCompleted = true;
      this.emit('complete', {
        status: 'interrupted',
        sessionId: this.currentSessionId || undefined,
      });
      this.currentTaskId = null;
      return;
    }

    // ================================================================
    // TOKEN TRACKING: Attempt to enrich from CLI storage and persist
    // ================================================================
    // AIDEV-NOTE: Run enrichment on code=0, OR when task already completed via step_finish
    // (Windows PTY kills with code=-1073741510 after task completion — still need to persist)
    if ((code === 0 || this.hasCompleted) && !this.pendingFallbackRestart) {
      this.enrichAndPersistTokens().catch((err) => {
        console.warn('[OpenCode Adapter] Token enrichment/persistence failed:', err);
        // Non-fatal: still persist what we have from stream
        this.persistTokenData();
      });
    }

    // Delegate to completion enforcer for verification/continuation handling
    if (code === 0 && !this.hasCompleted) {
      this.completionEnforcer
        .handleProcessExit(code)
        .then(() => {
          const completionStateAfter = CompletionFlowState[this.completionEnforcer.getState()];
          this.emit('debug', {
            type: 'completion_exit_state',
            message: 'Completion state after process exit handling',
            data: {
              exit_code: code,
              completion_state_after_exit: completionStateAfter,
              success_signal_seen: this.completionEnforcer.wasSuccessSignalSeen(),
              continuation_attempts: this.completionEnforcer.getContinuationAttempts(),
            },
          });
        })
        .catch((error) => {
          console.error('[OpenCode Adapter] Completion enforcer error:', error);
          if (this.completionEnforcer.wasSuccessSignalSeen()) {
            console.log('[OpenCode Adapter] Success signal was seen despite late error - completing as success');
            this.hasCompleted = true;
            this.emit('complete', { status: 'success', sessionId: this.currentSessionId || undefined });
            this.currentTaskId = null;
            return;
          }
          this.hasCompleted = true;
          this.emit('complete', {
            status: 'error',
            sessionId: this.currentSessionId || undefined,
            error: `Failed to complete: ${error.message}`,
          });
        });
      return; // Let completion enforcer handle next steps
    }

    // Only emit complete/error if we haven't already received a result message
    if (!this.hasCompleted) {
      if (code !== null && code !== 0) {
        // Error exit
        this.emit('error', new Error(`OpenCode CLI exited with code ${code}`));
      }
    }

    this.currentTaskId = null;
  }

  /**
   * Spawn a session resumption task with the given prompt.
   * Used by CompletionEnforcer callbacks for continuation and verification.
   *
   * WHY SESSION RESUMPTION (not PTY write):
   * - OpenCode CLI supports --session-id to continue an existing conversation
   * - This preserves full context (previous messages, tool results, etc.)
   * - PTY write would just inject text without proper message framing
   * - Session resumption creates a clean new API call with the prompt as a user message
   *
   * The same session ID is reused, so verification/continuation prompts appear
   * as natural follow-up messages in the conversation.
   */
  private async spawnSessionResumption(prompt: string): Promise<void> {
    // AIDEV-WARNING: Guard against stale retry timers invoking this after dispose/cancel
    if (this.isDisposed) {
      console.log('[OpenCode Adapter] spawnSessionResumption: SKIPPING - adapter is disposed');
      return;
    }

    const sessionId = this.currentSessionId;
    if (!sessionId) {
      throw new Error('No session ID available for session resumption');
    }

    console.log(`[OpenCode Adapter] Starting session resumption with session ${sessionId}`);

    // Reset stream parser for new process but preserve other state
    this.streamParser.reset();

    // Build args for resumption - reuse same model/settings
    const config: TaskConfig = {
      prompt,
      sessionId: sessionId,
      workingDirectory: this.lastWorkingDirectory,
    };

    const cliArgs = await this.buildCliArgs(config);

    // Get the bundled CLI path
    const { command, args: baseArgs } = getOpenCodeCliPath();
    console.log('[OpenCode Adapter] Session resumption command:', command, [...baseArgs, ...cliArgs].join(' '));

    // Build environment
    const env = await this.buildEnvironment();

    const allArgs = [...baseArgs, ...cliArgs];
    const safeCwd = config.workingDirectory || app.getPath('temp');

    // Start new PTY process for session resumption
    const fullCommand = this.buildShellCommand(command, allArgs);

    const shellCmd = this.getPlatformShell();
    const shellArgs = this.getShellArgs(fullCommand);

    this.ptyProcess = pty.spawn(shellCmd, shellArgs, {
      name: 'xterm-256color',
      cols: 30000,
      rows: 30,
      cwd: safeCwd,
      env: env as { [key: string]: string },
    });

    // Set up event handlers for new process
    this.ptyProcess.onData((data: string) => {
      // Filter out ANSI escape codes and control characters for cleaner parsing
      // Enhanced to handle Windows PowerShell sequences (cursor visibility, window titles)
      const cleanData = data
        .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')  // CSI sequences (added ? for DEC modes like cursor hide)
        .replace(/\x1B\][^\x07]*\x07/g, '')       // OSC sequences with BEL terminator (window titles)
        .replace(/\x1B\][^\x1B]*\x1B\\/g, '');    // OSC sequences with ST terminator
      if (cleanData.trim()) {
        // Truncate for console.log to avoid flooding terminal
        const truncated = cleanData.substring(0, 500) + (cleanData.length > 500 ? '...' : '');
        console.log('[OpenCode CLI stdout]:', truncated);
        // Send full data to debug panel
        this.emit('debug', { type: 'stdout', message: cleanData });

        this.streamParser.feed(cleanData);
      }
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      console.log('[OpenCode Adapter] Flushing stream parser before process exit');
      this.emit('debug', {
        type: 'process_exit',
        message: 'Flushing stream parser before process exit',
        data: { exit_code: exitCode, flushed_on_exit: true, path: 'resumption' },
      });
      this.streamParser.flush();
      this.handleProcessExit(exitCode);
    });
  }

  // ============================================================================
  // Token Tracking Helper Methods
  // ============================================================================

  /**
   * Persist accumulated token data to SQLite.
   * Safe to call multiple times — uses current accumulator state.
   *
   * AIDEV-WARNING: Must be called BEFORE killing PTY or clearing state.
   * AIDEV-NOTE: Non-fatal — logs errors but does not throw.
   */
  private persistTokenData(): void {
    const taskId = this.currentTaskId;
    if (!taskId) return;

    const entries = this.tokenAccumulator.getEntries();
    if (entries.length === 0) return;

    try {
      const records = entries.map((entry) => ({
        taskId,
        sessionId: this.currentSessionId || undefined,
        modelId: entry.modelId,
        provider: entry.provider,
        source: entry.source,
        stepNumber: entry.stepNumber,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        reasoningTokens: entry.reasoningTokens,
        cacheReadTokens: entry.cacheReadTokens,
        cacheWriteTokens: entry.cacheWriteTokens,
        costUsd: entry.costUsd,
        isEstimated: false,
        stepCount: entry.stepCount,
      }));
      tokenUsageRepo.saveBatch(records);
      console.log(`[OpenCode Adapter] Persisted ${records.length} token usage records for task ${taskId}`);

      // AIDEV-NOTE: Report usage to remote server (fire-and-forget)
      // Aggregate totals from all entries for this task
      const totalInput = records.reduce((sum, r) => sum + r.inputTokens, 0);
      const totalOutput = records.reduce((sum, r) => sum + r.outputTokens, 0);
      const totalCost = records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
      const primaryModel = records[0]?.modelId ?? 'unknown';
      const primaryProvider = records[0]?.provider ?? 'unknown';
      import('../services/usage-reporter')
        .then(({ reportUsageAsync }) => {
          reportUsageAsync({
            taskId,
            modelId: primaryModel,
            provider: primaryProvider,
            inputTokens: totalInput,
            outputTokens: totalOutput,
            costUsd: totalCost > 0 ? totalCost : null,
          });
        })
        .catch(() => {
          // AIDEV-NOTE: Non-fatal — usage reporting is best-effort
        });
    } catch (err) {
      console.error('[OpenCode Adapter] Failed to persist token data:', err);
    }
  }

  /**
   * Attempt to read token data from OpenCode CLI's flat-file storage
   * and merge with accumulated data, then persist.
   *
   * AIDEV-NOTE: CLI data is authoritative (real provider usage).
   * If CLI data is available, it replaces stream-parsed data.
   * AIDEV-WARNING: Coupled to CLI internal storage format — may break on CLI updates.
   */
  private async enrichAndPersistTokens(): Promise<void> {
    const taskId = this.currentTaskId;
    const sessionId = this.currentSessionId;
    if (!taskId || !sessionId) {
      this.persistTokenData();
      return;
    }

    const isAvailable = await this.fileReader.isAvailable();
    if (!isAvailable) {
      console.log('[OpenCode Adapter] CLI file storage not available, using stream data only');
      this.persistTokenData();
      return;
    }

    try {
      const sessionData = await this.fileReader.readSessionTokens(sessionId);
      if (!sessionData || sessionData.steps.length === 0) {
        console.log('[OpenCode Adapter] No token data from CLI storage, using stream data');
        this.persistTokenData();
        return;
      }

      // CLI data is authoritative — use it instead of stream data
      console.log(`[OpenCode Adapter] Enriching with ${sessionData.steps.length} steps from CLI storage`);
      const records = sessionData.steps.map((step, index) => ({
        taskId,
        sessionId,
        modelId: step.modelId,
        provider: step.provider,
        source: 'primary' as const,
        stepNumber: index + 1,
        inputTokens: step.inputTokens,
        outputTokens: step.outputTokens,
        reasoningTokens: step.reasoningTokens,
        cacheReadTokens: step.cacheReadTokens,
        cacheWriteTokens: step.cacheWriteTokens,
        costUsd: step.costUsd,
        isEstimated: false,
        stepCount: index + 1,
      }));

      tokenUsageRepo.saveBatch(records);
      console.log(`[OpenCode Adapter] Persisted ${records.length} enriched token records for task ${taskId}`);
    } catch (err) {
      console.warn('[OpenCode Adapter] CLI enrichment failed, falling back to stream data:', err);
      this.persistTokenData();
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get platform-appropriate shell command
   *
   * In packaged apps on macOS, we use /bin/sh instead of the user's shell
   * to avoid loading ANY user config files. Even non-login zsh loads ~/.zshenv
   * which may reference protected folders and trigger TCC permission dialogs.
   *
   * /bin/sh with -c flag doesn't load any user configuration.
   */
  private getPlatformShell(): string {
    if (process.platform === 'win32') {
      // Use PowerShell on Windows for better compatibility
      return 'powershell.exe';
    } else if (app.isPackaged && process.platform === 'darwin') {
      // In packaged macOS apps, use /bin/sh to avoid loading user shell configs
      // (zsh always loads ~/.zshenv, which may trigger TCC permissions)
      return '/bin/sh';
    } else {
      // In dev mode, use the user's shell for better compatibility
      const userShell = process.env.SHELL;
      if (userShell) {
        return userShell;
      }
      // Fallback chain: bash -> zsh -> sh
      if (fs.existsSync('/bin/bash')) return '/bin/bash';
      if (fs.existsSync('/bin/zsh')) return '/bin/zsh';
      return '/bin/sh';
    }
  }

  /**
   * Get shell arguments for running a command
   *
   * Note: We intentionally do NOT use login shell (-l) on macOS to avoid
   * triggering folder access permissions (TCC). Login shells load ~/.zprofile
   * and ~/.zshrc which may reference protected folders like Desktop/Documents.
   *
   * Instead, we extend PATH in buildEnvironment() using path_helper and common
   * Node.js installation paths. This is the proper macOS approach for GUI apps.
   */
  private getShellArgs(command: string): string[] {
    if (process.platform === 'win32') {
      // PowerShell: Use -EncodedCommand with Base64-encoded UTF-16LE to avoid
      // all escaping/parsing issues. This is the most reliable way to pass
      // complex commands with quotes, special characters, etc. to PowerShell.
      const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
      return ['-NoProfile', '-EncodedCommand', encodedCommand];
    } else {
      // Unix shells: -c to run command (no -l to avoid profile loading)
      return ['-c', command];
    }
  }
}

interface AskUserQuestionInput {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
}

/**
 * Factory function to create a new adapter instance
 * Use this for the new per-task architecture via TaskManager
 */
export function createAdapter(taskId?: string): OpenCodeAdapter {
  return new OpenCodeAdapter(taskId);
}

/**
 * @deprecated Use TaskManager and createAdapter() instead.
 * Singleton instance kept for backward compatibility during migration.
 */
let adapterInstance: OpenCodeAdapter | null = null;

/**
 * @deprecated Use TaskManager and createAdapter() instead.
 * Get the legacy singleton adapter instance.
 */
export function getOpenCodeAdapter(): OpenCodeAdapter {
  if (!adapterInstance) {
    adapterInstance = new OpenCodeAdapter();
  }
  return adapterInstance;
}
