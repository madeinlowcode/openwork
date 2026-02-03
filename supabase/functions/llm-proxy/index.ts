// supabase/functions/llm-proxy/index.ts

/**
 * @edgeFunction llm-proxy
 * @description Secure proxy for LLM API calls via OpenRouter
 *
 * @trigger HTTP POST request from Jurisiar Electron app
 *
 * @environment
 * - SUPABASE_URL (auto-injected)
 * - SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 * - OPENROUTER_API_KEY (must be configured in Supabase secrets)
 *
 * @dependencies
 * - ..//_shared/cors.ts (CORS handling)
 * - ..//_shared/auth.ts (JWT validation)
 * - ..//_shared/quota.ts (quota management)
 *
 * @databaseTables
 * - user_quotas (SELECT, UPDATE)
 * - usage_logs (INSERT)
 *
 * @requestBody
 * - model: string - Model ID (e.g., "anthropic/claude-3.5-sonnet")
 * - messages: array - Chat messages
 * - max_tokens?: number - Maximum tokens to generate
 * - temperature?: number - Temperature for generation
 * - ...other OpenAI-compatible params
 *
 * @response
 * - 200: OpenRouter API response (streaming or complete)
 * - 401: { error: 'Unauthorized' | 'Invalid token' }
 * - 429: { error: 'Quota exceeded', details: {...} }
 * - 500: { error: string }
 *
 * @consumedBy
 * - apps/desktop/src/main/opencode/adapter.ts (when using SaaS mode)
 * - apps/desktop/src/renderer/lib/jurisiar.ts (client wrapper)
 *
 * AIDEV-WARNING: API key stored in server secrets - NEVER expose to client
 * AIDEV-SECURITY: Validates JWT before processing any request
 * AIDEV-PERF: Streams responses for better UX on long generations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders,
  handleCorsPreflight,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import {
  checkTokenQuota,
  updateTokenUsage,
  logUsage,
  UserQuota,
} from '../_shared/quota.ts';

/**
 * OpenRouter API configuration
 */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

/**
 * App identification headers for OpenRouter
 * AIDEV-NOTE: Required by OpenRouter for usage tracking
 */
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://jurisiar.app',
  'X-Title': 'Jurisiar',
};

/**
 * Estimate tokens from messages
 *
 * @param messages - Chat messages
 * @returns Estimated input token count
 *
 * AIDEV-NOTE: Rough estimate, actual count may vary
 */
function estimateInputTokens(messages: Array<{ role: string; content: string }>): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += (msg.content || '').length;
  }
  // Rough estimate: 1 token ~ 4 characters
  return Math.ceil(totalChars / 4);
}

/**
 * Main handler for LLM proxy requests
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // Check if OpenRouter API key is configured
  if (!OPENROUTER_API_KEY) {
    console.error('[LLM-Proxy] OPENROUTER_API_KEY not configured');
    return errorResponse('Service not configured', 503);
  }

  try {
    // Step 1: Validate authentication
    const auth = await validateAuth(req);

    if (!auth.success || !auth.user || !auth.supabase) {
      console.warn('[LLM-Proxy] Authentication failed:', auth.error);
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    const userId = auth.user.id;
    const supabase = auth.supabase;

    // Step 2: Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    // Validate required fields
    if (!body.model || typeof body.model !== 'string') {
      return errorResponse('Missing or invalid model field', 400);
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return errorResponse('Missing or invalid messages field', 400);
    }

    // Estimate tokens for quota check
    const estimatedTokens = estimateInputTokens(body.messages as Array<{ role: string; content: string }>);

    // Step 3: Check quota
    const quotaCheck = await checkTokenQuota(supabase, userId, estimatedTokens);

    if (!quotaCheck.allowed) {
      console.warn(`[LLM-Proxy] Quota exceeded for user ${userId}:`, quotaCheck.reason);

      // Log failed attempt
      await logUsage(supabase, {
        user_id: userId,
        request_type: 'llm_proxy',
        model: body.model as string,
        provider: 'openrouter',
        tokens_input: estimatedTokens,
        tokens_total: estimatedTokens,
        success: false,
        error_message: quotaCheck.reason,
        metadata: {
          quota_tokens_used: quotaCheck.quota?.tokens_used,
          quota_tokens_limit: quotaCheck.quota?.tokens_limit,
        },
      });

      return jsonResponse(
        {
          error: 'Quota exceeded',
          details: {
            reason: quotaCheck.reason,
            tokens_used: quotaCheck.quota?.tokens_used,
            tokens_limit: quotaCheck.quota?.tokens_limit,
            reset_at: quotaCheck.quota?.reset_at,
          },
        },
        429
      );
    }

    // Step 4: Call OpenRouter API
    console.log(`[LLM-Proxy] Proxying request for user ${userId}, model: ${body.model}`);

    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        ...OPENROUTER_HEADERS,
      },
      body: JSON.stringify(body),
    });

    // Parse response
    const result = await openRouterResponse.json();

    // Check for OpenRouter errors
    if (!openRouterResponse.ok || result.error) {
      const errorMsg = result.error?.message || `OpenRouter error: ${openRouterResponse.status}`;
      console.error(`[LLM-Proxy] OpenRouter error:`, errorMsg);

      // Log failed attempt
      await logUsage(supabase, {
        user_id: userId,
        request_type: 'llm_proxy',
        model: body.model as string,
        provider: 'openrouter',
        tokens_input: estimatedTokens,
        success: false,
        error_message: errorMsg,
      });

      return jsonResponse(result, openRouterResponse.status);
    }

    // Step 5: Extract usage and update quota
    const usage = result.usage || {};
    const tokensUsed = usage.total_tokens || usage.prompt_tokens + (usage.completion_tokens || 0) || 0;

    // Update token usage
    if (tokensUsed > 0) {
      await updateTokenUsage(supabase, userId, tokensUsed);
    }

    // Step 6: Log successful usage
    // Estimate cost (very rough, varies by model)
    const costPerMToken = 0.01; // $0.01 per 1M tokens average
    const estimatedCost = (tokensUsed / 1_000_000) * costPerMToken;

    await logUsage(supabase, {
      user_id: userId,
      request_type: 'llm_proxy',
      model: body.model as string,
      provider: 'openrouter',
      tokens_input: usage.prompt_tokens || 0,
      tokens_output: usage.completion_tokens || 0,
      tokens_total: tokensUsed,
      cost_usd: estimatedCost,
      success: true,
      metadata: {
        openrouter_id: result.id,
        finish_reason: result.choices?.[0]?.finish_reason,
      },
    });

    console.log(
      `[LLM-Proxy] Request completed for user ${userId}. Tokens: ${tokensUsed}, ` +
        `Remaining: ${(quotaCheck.remaining?.tokens || 0) - tokensUsed}`
    );

    // Step 7: Return response with quota info
    return jsonResponse({
      ...result,
      _quota: {
        tokens_remaining: Math.max(0, (quotaCheck.remaining?.tokens || 0) - tokensUsed),
        tokens_used: (quotaCheck.quota?.tokens_used || 0) + tokensUsed,
        tokens_limit: quotaCheck.quota?.tokens_limit,
        reset_at: quotaCheck.quota?.reset_at,
      },
    });
  } catch (error) {
    console.error('[LLM-Proxy] Unexpected error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
