// apps/desktop/src/main/opencode/fallback/index.ts

/**
 * @file index.ts
 * @description Re-exports for the fallback engine module
 *
 * @context Fallback system - public API for the fallback engine
 *
 * @dependencies
 * - ./types.ts
 * - ./rate-limit-detector.ts
 * - ./tool-dictionary.ts
 * - ./context-generator.ts
 * - ./fallback-engine.ts
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/adapter.ts (main consumer)
 * - apps/desktop/src/main/ipc/handlers.ts (IPC integration)
 *
 * @usedBy
 * - OpenCodeAdapter (adapter.ts)
 * - IPC handlers (handlers.ts)
 *
 * AIDEV-NOTE: Import from this file for clean API access
 * AIDEV-WARNING: Only export public API, keep internal functions private
 */

// Types
export type {
  RateLimitDetectionResult,
  RateLimitErrorType,
  ContextGeneratorOptions,
  ContextGenerationResult,
  FallbackEngineOptions,
  FallbackHandleResult,
  FallbackEngineEvents,
  ToolCallInfo,
  TranslatedAction,
} from './types';

// Rate limit detection
export {
  isRateLimitError,
  detectRateLimitProvider,
  getRateLimitRetryAfter,
  detectRateLimit,
} from './rate-limit-detector';

// Tool translation
export {
  translateToolCall,
  translateToolCalls,
  translateToolCallsWithInfo,
  isKnownTool,
  getKnownToolNames,
} from './tool-dictionary';

// Context generation
export {
  generateContinuationContext,
  generateMinimalContext,
  getContextStats,
} from './context-generator';

// Fallback engine
export {
  FallbackEngine,
  createFallbackEngine,
  shouldTriggerFallback,
} from './fallback-engine';
