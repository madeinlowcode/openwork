// apps/desktop/src/main/opencode/fallback/rate-limit-detector.ts

/**
 * @file rate-limit-detector.ts
 * @description Detects rate limit errors from various AI providers
 *
 * @context Fallback system - first line of detection for triggering fallback
 *
 * @dependencies
 * - ./types.ts (RateLimitDetectionResult, RateLimitErrorType)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/fallback/fallback-engine.ts (main consumer)
 * - apps/desktop/src/main/opencode/adapter.ts (error source)
 *
 * @usedBy
 * - fallback-engine.ts (handleError method)
 *
 * AIDEV-NOTE: Supports multiple providers including Anthropic, OpenAI, Google, MiniMax
 * AIDEV-WARNING: Patterns must be kept in sync with provider error formats
 */

import type { RateLimitDetectionResult, RateLimitErrorType } from './types';

/**
 * Rate limit detection patterns organized by error type
 *
 * AIDEV-NOTE: Patterns are case-insensitive
 * AIDEV-NOTE: Chinese patterns support MiniMax provider
 */
const RATE_LIMIT_PATTERNS: Record<RateLimitErrorType, RegExp[]> = {
  rate_limit: [
    /rate[_\s-]?limit/i,
    /ratelimit/i,
    /rate_limit_exceeded/i,
    /RateLimitError/i,
  ],
  quota_exceeded: [
    /quota[_\s-]?exceeded/i,
    /quota_exceeded/i,
    /insufficient[_\s-]?quota/i,
    /billing[_\s-]?limit/i,
  ],
  too_many_requests: [
    /too[_\s-]?many[_\s-]?requests/i,
    /\b429\b/,
    /HTTP[_\s-]?429/i,
    /status[_\s:]?\s*429/i,
  ],
  concurrent_limit: [
    /并发/,  // Chinese: concurrency
    /请求过多/, // Chinese: too many requests
    /concurrent[_\s-]?limit/i,
    /concurrent[_\s-]?request/i,
    /simultaneous[_\s-]?request/i,
  ],
  unknown: [],
};

/**
 * HTTP status codes that indicate rate limiting
 */
const RATE_LIMIT_STATUS_CODES = [429, 503];

/**
 * Provider detection patterns
 *
 * AIDEV-NOTE: Maps error message patterns to provider names
 */
const PROVIDER_PATTERNS: Record<string, RegExp[]> = {
  anthropic: [
    /anthropic/i,
    /claude/i,
    /x-ratelimit-limit-requests/i,
  ],
  openai: [
    /openai/i,
    /gpt-/i,
    /chatgpt/i,
    /x-ratelimit-remaining-requests/i,
  ],
  google: [
    /google/i,
    /gemini/i,
    /vertex/i,
    /generativelanguage\.googleapis/i,
  ],
  xai: [
    /xai/i,
    /grok/i,
    /x\.ai/i,
  ],
  minimax: [
    /minimax/i,
    /并发/,
    /请求过多/,
    /abab/i,
  ],
  openrouter: [
    /openrouter/i,
  ],
  azure: [
    /azure/i,
    /microsoft\.com/i,
  ],
};

/**
 * Retry-After header patterns for extracting delay
 *
 * AIDEV-NOTE: Supports both seconds and milliseconds formats
 */
const RETRY_AFTER_PATTERNS = [
  /retry[_\s-]?after[:\s]+(\d+)/i,
  /wait[_\s-]?(\d+)[_\s-]?(seconds?|ms|milliseconds?)?/i,
  /try[_\s-]?again[_\s-]?in[_\s-]?(\d+)/i,
  /"retry_after":\s*(\d+)/i,
  /retryAfter[:\s]+(\d+)/i,
];

/**
 * Normalize error to string format
 *
 * @param error - Error to normalize
 * @returns String representation of the error
 *
 * AIDEV-NOTE: Handles Error objects, strings, and unknown types
 */
function normalizeError(error: string | Error | unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Detect the type of rate limit error
 *
 * @param errorStr - Error string to analyze
 * @returns The detected error type
 *
 * AIDEV-NOTE: Returns 'unknown' if no specific type matches but is rate limit
 */
function detectErrorType(errorStr: string): RateLimitErrorType {
  // Check each error type in order of specificity
  const types: RateLimitErrorType[] = [
    'quota_exceeded',
    'concurrent_limit',
    'too_many_requests',
    'rate_limit',
  ];

  for (const type of types) {
    const patterns = RATE_LIMIT_PATTERNS[type];
    for (const pattern of patterns) {
      if (pattern.test(errorStr)) {
        return type;
      }
    }
  }

  return 'unknown';
}

/**
 * Check if an error is a rate limit error
 *
 * @param error - The error to check (string or Error object)
 * @returns True if the error indicates rate limiting
 *
 * @example
 * if (isRateLimitError(error)) {
 *   // Trigger fallback
 * }
 *
 * AIDEV-NOTE: Checks all known rate limit patterns
 */
export function isRateLimitError(error: string | Error): boolean {
  const errorStr = normalizeError(error);
  
  // Check all pattern categories
  for (const type of Object.keys(RATE_LIMIT_PATTERNS) as RateLimitErrorType[]) {
    if (type === 'unknown') continue;
    
    for (const pattern of RATE_LIMIT_PATTERNS[type]) {
      if (pattern.test(errorStr)) {
        return true;
      }
    }
  }

  // Also check for HTTP status codes
  for (const code of RATE_LIMIT_STATUS_CODES) {
    if (errorStr.includes(String(code))) {
      // Make sure it's in a context that suggests status code
      if (/status|code|http|error/i.test(errorStr)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect which provider caused the rate limit error
 *
 * @param error - The error to analyze
 * @returns Provider name or null if not detectable
 *
 * @example
 * const provider = detectRateLimitProvider(error);
 * console.log(`Rate limited by: ${provider || 'unknown provider'}`);
 *
 * AIDEV-NOTE: Returns null if provider cannot be determined
 */
export function detectRateLimitProvider(error: string | Error): string | null {
  const errorStr = normalizeError(error);

  for (const [provider, patterns] of Object.entries(PROVIDER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(errorStr)) {
        return provider;
      }
    }
  }

  return null;
}

/**
 * Extract retry-after delay from error message
 *
 * @param error - The error to analyze
 * @returns Delay in milliseconds, or null if not found
 *
 * @example
 * const delay = getRateLimitRetryAfter(error);
 * if (delay) {
 *   await new Promise(r => setTimeout(r, delay));
 * }
 *
 * AIDEV-NOTE: Automatically converts seconds to milliseconds if needed
 */
export function getRateLimitRetryAfter(error: string | Error): number | null {
  const errorStr = normalizeError(error);

  for (const pattern of RETRY_AFTER_PATTERNS) {
    const match = errorStr.match(pattern);
    if (match && match[1]) {
      let value = parseInt(match[1], 10);
      
      if (isNaN(value) || value <= 0) {
        continue;
      }

      // Check if it's in seconds or milliseconds
      const unit = match[2]?.toLowerCase();
      if (unit === 'ms' || unit === 'milliseconds') {
        return value;
      }
      
      // If no unit or seconds, assume seconds if value is small
      if (value < 1000) {
        return value * 1000; // Convert to milliseconds
      }
      
      return value;
    }
  }

  return null;
}

/**
 * Full rate limit detection with all available information
 *
 * @param error - The error to analyze
 * @returns Complete detection result with all available info
 *
 * @example
 * const result = detectRateLimit(error);
 * if (result.isRateLimit) {
 *   console.log(`Rate limited by ${result.provider}, retry after ${result.retryAfterMs}ms`);
 * }
 *
 * AIDEV-NOTE: Use this for complete detection, individual functions for specific needs
 */
export function detectRateLimit(error: string | Error): RateLimitDetectionResult {
  const errorStr = normalizeError(error);
  const isRate = isRateLimitError(error);

  if (!isRate) {
    return {
      isRateLimit: false,
      provider: null,
      retryAfterMs: null,
      errorType: 'unknown',
    };
  }

  return {
    isRateLimit: true,
    provider: detectRateLimitProvider(error),
    retryAfterMs: getRateLimitRetryAfter(error),
    errorType: detectErrorType(errorStr),
  };
}
