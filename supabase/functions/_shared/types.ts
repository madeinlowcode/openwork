// supabase/functions/_shared/types.ts

/**
 * @file types.ts
 * @description Shared TypeScript types for Supabase Edge Functions
 *
 * @context Jurisiar Backend - Type definitions for API contracts
 *
 * @usedBy
 * - supabase/functions/llm-proxy/index.ts
 * - supabase/functions/llm-summarize/index.ts
 * - apps/desktop/src/renderer/lib/jurisiar.ts (client)
 *
 * AIDEV-NOTE: Keep in sync with client types
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request body for llm-proxy endpoint
 */
export interface LLMProxyRequest {
  /** Model ID (e.g., "anthropic/claude-3.5-sonnet") */
  model: string;
  /** Chat messages */
  messages: ChatMessage[];
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Top P sampling */
  top_p?: number;
  /** Stop sequences */
  stop?: string[];
  /** Stream responses */
  stream?: boolean;
}

/**
 * Chat message format (OpenAI compatible)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Request body for llm-summarize endpoint
 */
export interface LLMSummarizeRequest {
  /** Original task description */
  taskDescription: string;
  /** List of tool calls to summarize */
  toolCalls: string | string[];
  /** Last assistant response (optional) */
  lastResponse?: string;
  /** Maximum tokens for summary (default: 300) */
  maxTokens?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Quota information included in responses
 */
export interface QuotaInfo {
  /** Tokens remaining in current period */
  tokens_remaining: number;
  /** Tokens used in current period */
  tokens_used?: number;
  /** Token limit for current plan */
  tokens_limit?: number;
  /** Fallbacks remaining in current period */
  fallbacks_remaining?: number;
  /** Fallbacks used in current period */
  fallbacks_used?: number;
  /** Fallback limit for current plan */
  fallbacks_limit?: number;
  /** When quotas reset */
  reset_at?: string;
}

/**
 * Response from llm-proxy endpoint
 */
export interface LLMProxyResponse {
  /** OpenRouter response ID */
  id: string;
  /** Response choices */
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  /** Token usage */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Quota information */
  _quota: QuotaInfo;
}

/**
 * Response from llm-summarize endpoint
 */
export interface LLMSummarizeResponse {
  /** Generated summary */
  summary: string;
  /** Tokens consumed */
  tokens_used: number;
  /** Model used for summarization */
  model: string;
  /** Quota information */
  _quota: QuotaInfo;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  /** Error message */
  error: string;
  /** Additional details (for quota errors) */
  details?: {
    reason?: string;
    tokens_used?: number;
    tokens_limit?: number;
    fallbacks_used?: number;
    fallbacks_limit?: number;
    reset_at?: string;
  };
}

// ============================================================================
// Database Types
// ============================================================================

/**
 * User quota record from database
 */
export interface UserQuotaRecord {
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  tokens_used: number;
  tokens_limit: number;
  fallbacks_used: number;
  fallbacks_limit: number;
  reset_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Usage log record from database
 */
export interface UsageLogRecord {
  id: string;
  user_id: string;
  request_type: 'llm_proxy' | 'llm_summarize' | 'fallback';
  model: string | null;
  provider: string | null;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_usd: number;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Plan Configuration
// ============================================================================

/**
 * Plan limits configuration
 */
export const PLAN_LIMITS = {
  free: {
    tokens: 10_000,
    fallbacks: 10,
  },
  pro: {
    tokens: 100_000,
    fallbacks: 100,
  },
  enterprise: {
    tokens: Infinity,
    fallbacks: Infinity,
  },
} as const;

/**
 * Plan type
 */
export type PlanType = keyof typeof PLAN_LIMITS;
