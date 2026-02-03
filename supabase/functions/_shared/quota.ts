// supabase/functions/_shared/quota.ts

/**
 * @file quota.ts
 * @description Quota management utilities for Supabase Edge Functions
 *
 * @context Jurisiar Backend - Checks and updates user quotas
 *
 * @dependencies
 * - @supabase/supabase-js (SupabaseClient)
 *
 * @databaseTables
 * - user_quotas (SELECT, UPDATE)
 * - usage_logs (INSERT)
 *
 * @usedBy
 * - supabase/functions/llm-proxy/index.ts
 * - supabase/functions/llm-summarize/index.ts
 *
 * AIDEV-WARNING: All quota operations require service_role client
 * AIDEV-NOTE: Quotas reset monthly based on reset_at timestamp
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * User quota information
 */
export interface UserQuota {
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  tokens_used: number;
  tokens_limit: number;
  fallbacks_used: number;
  fallbacks_limit: number;
  reset_at: string;
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  allowed: boolean;
  quota?: UserQuota;
  reason?: string;
  remaining?: {
    tokens: number;
    fallbacks: number;
  };
}

/**
 * Usage log entry
 */
export interface UsageLogEntry {
  user_id: string;
  request_type: 'llm_proxy' | 'llm_summarize' | 'fallback';
  model?: string;
  provider?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_total?: number;
  cost_usd?: number;
  success?: boolean;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Plan limits configuration
 *
 * AIDEV-NOTE: These should match the database defaults
 */
export const PLAN_LIMITS = {
  free: {
    tokens: 10000,
    fallbacks: 10,
  },
  pro: {
    tokens: 100000,
    fallbacks: 100,
  },
  enterprise: {
    tokens: Infinity,
    fallbacks: Infinity,
  },
} as const;

/**
 * Get user quota from database
 *
 * @param supabase - Supabase client with service role
 * @param userId - User ID to look up
 * @returns User quota or null if not found
 *
 * AIDEV-NOTE: Creates quota if it doesn't exist (handles race condition with trigger)
 */
export async function getUserQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<UserQuota | null> {
  const { data, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If not found, the trigger might not have run yet
    if (error.code === 'PGRST116') {
      console.log('[Quota] Quota not found, creating for user:', userId);
      const { data: newQuota, error: insertError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: userId,
          reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Quota] Failed to create quota:', insertError);
        return null;
      }
      return newQuota as UserQuota;
    }

    console.error('[Quota] Error fetching quota:', error);
    return null;
  }

  return data as UserQuota;
}

/**
 * Check if user has sufficient quota for tokens
 *
 * @param supabase - Supabase client with service role
 * @param userId - User ID to check
 * @param estimatedTokens - Estimated tokens for the request (optional)
 * @returns QuotaCheckResult indicating if request is allowed
 *
 * @example
 * const check = await checkTokenQuota(supabase, userId, 1000);
 * if (!check.allowed) {
 *   return errorResponse(check.reason!, 429);
 * }
 *
 * AIDEV-WARNING: Always check quota before making LLM requests
 */
export async function checkTokenQuota(
  supabase: SupabaseClient,
  userId: string,
  estimatedTokens: number = 0
): Promise<QuotaCheckResult> {
  const quota = await getUserQuota(supabase, userId);

  if (!quota) {
    return {
      allowed: false,
      reason: 'Could not retrieve user quota',
    };
  }

  // Check if quota needs reset
  if (new Date(quota.reset_at) <= new Date()) {
    // Reset quota
    const { error: resetError } = await supabase
      .from('user_quotas')
      .update({
        tokens_used: 0,
        fallbacks_used: 0,
        reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('user_id', userId);

    if (resetError) {
      console.error('[Quota] Failed to reset quota:', resetError);
    } else {
      quota.tokens_used = 0;
      quota.fallbacks_used = 0;
    }
  }

  // Enterprise plan has unlimited tokens
  if (quota.plan === 'enterprise') {
    return {
      allowed: true,
      quota,
      remaining: {
        tokens: Infinity,
        fallbacks: Infinity,
      },
    };
  }

  // Check token limit
  const tokensRemaining = quota.tokens_limit - quota.tokens_used;

  if (tokensRemaining <= 0) {
    return {
      allowed: false,
      quota,
      reason: `Token quota exceeded. Used: ${quota.tokens_used}/${quota.tokens_limit}. Resets at: ${quota.reset_at}`,
      remaining: {
        tokens: 0,
        fallbacks: quota.fallbacks_limit - quota.fallbacks_used,
      },
    };
  }

  // Warn if close to limit
  if (estimatedTokens > 0 && estimatedTokens > tokensRemaining) {
    console.warn(
      `[Quota] User ${userId} estimated tokens (${estimatedTokens}) exceeds remaining (${tokensRemaining})`
    );
  }

  return {
    allowed: true,
    quota,
    remaining: {
      tokens: tokensRemaining,
      fallbacks: quota.fallbacks_limit - quota.fallbacks_used,
    },
  };
}

/**
 * Check if user has sufficient fallback quota
 *
 * @param supabase - Supabase client with service role
 * @param userId - User ID to check
 * @returns QuotaCheckResult indicating if fallback is allowed
 *
 * AIDEV-NOTE: Fallbacks are counted separately from regular token usage
 */
export async function checkFallbackQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<QuotaCheckResult> {
  const quota = await getUserQuota(supabase, userId);

  if (!quota) {
    return {
      allowed: false,
      reason: 'Could not retrieve user quota',
    };
  }

  // Enterprise plan has unlimited fallbacks
  if (quota.plan === 'enterprise') {
    return {
      allowed: true,
      quota,
      remaining: {
        tokens: Infinity,
        fallbacks: Infinity,
      },
    };
  }

  // Check fallback limit
  const fallbacksRemaining = quota.fallbacks_limit - quota.fallbacks_used;

  if (fallbacksRemaining <= 0) {
    return {
      allowed: false,
      quota,
      reason: `Fallback quota exceeded. Used: ${quota.fallbacks_used}/${quota.fallbacks_limit}. Resets at: ${quota.reset_at}`,
      remaining: {
        tokens: quota.tokens_limit - quota.tokens_used,
        fallbacks: 0,
      },
    };
  }

  return {
    allowed: true,
    quota,
    remaining: {
      tokens: quota.tokens_limit - quota.tokens_used,
      fallbacks: fallbacksRemaining,
    },
  };
}

/**
 * Update user token usage
 *
 * @param supabase - Supabase client with service role
 * @param userId - User ID to update
 * @param tokensUsed - Number of tokens consumed
 * @returns True if update succeeded
 *
 * AIDEV-NOTE: Should be called after successful LLM request
 */
export async function updateTokenUsage(
  supabase: SupabaseClient,
  userId: string,
  tokensUsed: number
): Promise<boolean> {
  const { error } = await supabase.rpc('increment_tokens_used', {
    p_user_id: userId,
    p_tokens: tokensUsed,
  });

  // Fallback to direct update if RPC doesn't exist
  if (error && error.code === 'PGRST202') {
    const quota = await getUserQuota(supabase, userId);
    if (!quota) return false;

    const { error: updateError } = await supabase
      .from('user_quotas')
      .update({
        tokens_used: quota.tokens_used + tokensUsed,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Quota] Failed to update token usage:', updateError);
      return false;
    }
  } else if (error) {
    console.error('[Quota] Failed to increment tokens:', error);
    return false;
  }

  return true;
}

/**
 * Update user fallback usage
 *
 * @param supabase - Supabase client with service role
 * @param userId - User ID to update
 * @returns True if update succeeded
 *
 * AIDEV-NOTE: Should be called after successful fallback
 */
export async function incrementFallbackUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const quota = await getUserQuota(supabase, userId);
  if (!quota) return false;

  const { error } = await supabase
    .from('user_quotas')
    .update({
      fallbacks_used: quota.fallbacks_used + 1,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Quota] Failed to increment fallback usage:', error);
    return false;
  }

  return true;
}

/**
 * Log usage to database
 *
 * @param supabase - Supabase client with service role
 * @param entry - Usage log entry
 * @returns True if log succeeded
 *
 * @example
 * await logUsage(supabase, {
 *   user_id: userId,
 *   request_type: 'llm_proxy',
 *   model: 'claude-opus-4-5',
 *   provider: 'openrouter',
 *   tokens_total: 1500,
 *   success: true,
 * });
 *
 * AIDEV-NOTE: Always log usage, even on failure (for debugging)
 */
export async function logUsage(
  supabase: SupabaseClient,
  entry: UsageLogEntry
): Promise<boolean> {
  const { error } = await supabase.from('usage_logs').insert({
    user_id: entry.user_id,
    request_type: entry.request_type,
    model: entry.model || null,
    provider: entry.provider || null,
    tokens_input: entry.tokens_input || 0,
    tokens_output: entry.tokens_output || 0,
    tokens_total: entry.tokens_total || 0,
    cost_usd: entry.cost_usd || 0,
    success: entry.success ?? true,
    error_message: entry.error_message || null,
    metadata: entry.metadata || {},
  });

  if (error) {
    console.error('[Quota] Failed to log usage:', error);
    return false;
  }

  return true;
}
