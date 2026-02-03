// supabase/functions/llm-summarize/index.ts

/**
 * @edgeFunction llm-summarize
 * @description Summarizes task progress for fallback context generation
 *
 * @trigger HTTP POST request from Jurisiar Electron app
 *
 * @environment
 * - SUPABASE_URL (auto-injected)
 * - SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 * - OPENROUTER_API_KEY (must be configured in Supabase secrets)
 * - SUMMARIZATION_MODEL (optional, defaults to gemini-flash-1.5-8b)
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
 * - taskDescription: string - Original task description
 * - toolCalls: string | array - List of tool calls to summarize
 * - lastResponse?: string - Last assistant response (optional)
 * - maxTokens?: number - Maximum tokens for summary (default: 300)
 *
 * @response
 * - 200: { summary: string, tokens_used: number, _quota: {...} }
 * - 401: { error: 'Unauthorized' | 'Invalid token' }
 * - 429: { error: 'Quota exceeded', details: {...} }
 * - 500: { error: string }
 *
 * @consumedBy
 * - apps/desktop/src/main/opencode/fallback/context-generator.ts
 *
 * AIDEV-WARNING: This function consumes tokens from user quota
 * AIDEV-SECURITY: Validates JWT before processing any request
 * AIDEV-PERF: Uses cheap model (Gemini Flash) for cost efficiency
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
  incrementFallbackUsage,
  checkFallbackQuota,
} from '../_shared/quota.ts';

/**
 * OpenRouter API configuration
 */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

/**
 * Default summarization model
 * AIDEV-NOTE: Gemini Flash is very cheap (~$0.0001 per 1K tokens)
 */
const DEFAULT_SUMMARIZATION_MODEL =
  Deno.env.get('SUMMARIZATION_MODEL') || 'google/gemini-flash-1.5-8b';

/**
 * App identification headers for OpenRouter
 */
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://jurisiar.app',
  'X-Title': 'Jurisiar - Context Summarization',
};

/**
 * System prompt for summarization
 */
const SUMMARIZATION_SYSTEM_PROMPT = `Voce e um assistente especializado em resumir o progresso de tarefas de forma concisa.

Sua funcao:
1. Analisar a tarefa original e as acoes ja realizadas
2. Criar um resumo claro e objetivo do progresso
3. Destacar o que foi concluido e o que falta fazer
4. Manter o resumo em 2-4 frases

Formato do resumo:
- Use portugues brasileiro
- Seja direto e informativo
- Foque nas acoes mais importantes
- Mencione dados relevantes coletados`;

/**
 * Build summarization prompt
 */
function buildSummarizationPrompt(
  taskDescription: string,
  toolCalls: string | string[],
  lastResponse?: string
): string {
  const toolCallsStr = Array.isArray(toolCalls) ? toolCalls.join('\n') : toolCalls;

  let prompt = `Resuma o progresso desta tarefa:

## Tarefa Original
${taskDescription}

## Acoes Realizadas
${toolCallsStr || 'Nenhuma acao registrada'}`;

  if (lastResponse) {
    prompt += `

## Ultima Resposta do Assistente
${lastResponse.substring(0, 500)}${lastResponse.length > 500 ? '...' : ''}`;
  }

  prompt += `

## Instrucao
Crie um resumo conciso (2-4 frases) do progresso desta tarefa, destacando:
1. O que ja foi feito
2. Dados importantes coletados
3. Proximos passos implicitos`;

  return prompt;
}

/**
 * Main handler for summarization requests
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
    console.error('[LLM-Summarize] OPENROUTER_API_KEY not configured');
    return errorResponse('Service not configured', 503);
  }

  try {
    // Step 1: Validate authentication
    const auth = await validateAuth(req);

    if (!auth.success || !auth.user || !auth.supabase) {
      console.warn('[LLM-Summarize] Authentication failed:', auth.error);
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    const userId = auth.user.id;
    const supabase = auth.supabase;

    // Step 2: Parse request body
    let body: {
      taskDescription?: string;
      toolCalls?: string | string[];
      lastResponse?: string;
      maxTokens?: number;
    };

    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    // Validate required fields
    if (!body.taskDescription || typeof body.taskDescription !== 'string') {
      return errorResponse('Missing or invalid taskDescription field', 400);
    }

    if (body.toolCalls === undefined) {
      return errorResponse('Missing toolCalls field', 400);
    }

    const maxTokens = body.maxTokens || 300;

    // Step 3: Check both token and fallback quotas
    const tokenQuota = await checkTokenQuota(supabase, userId, maxTokens * 2);
    const fallbackQuota = await checkFallbackQuota(supabase, userId);

    if (!tokenQuota.allowed) {
      console.warn(`[LLM-Summarize] Token quota exceeded for user ${userId}`);

      await logUsage(supabase, {
        user_id: userId,
        request_type: 'llm_summarize',
        model: DEFAULT_SUMMARIZATION_MODEL,
        provider: 'openrouter',
        success: false,
        error_message: tokenQuota.reason,
      });

      return jsonResponse(
        {
          error: 'Token quota exceeded',
          details: {
            reason: tokenQuota.reason,
            tokens_used: tokenQuota.quota?.tokens_used,
            tokens_limit: tokenQuota.quota?.tokens_limit,
            reset_at: tokenQuota.quota?.reset_at,
          },
        },
        429
      );
    }

    if (!fallbackQuota.allowed) {
      console.warn(`[LLM-Summarize] Fallback quota exceeded for user ${userId}`);

      await logUsage(supabase, {
        user_id: userId,
        request_type: 'llm_summarize',
        model: DEFAULT_SUMMARIZATION_MODEL,
        provider: 'openrouter',
        success: false,
        error_message: fallbackQuota.reason,
      });

      return jsonResponse(
        {
          error: 'Fallback quota exceeded',
          details: {
            reason: fallbackQuota.reason,
            fallbacks_used: fallbackQuota.quota?.fallbacks_used,
            fallbacks_limit: fallbackQuota.quota?.fallbacks_limit,
            reset_at: fallbackQuota.quota?.reset_at,
          },
        },
        429
      );
    }

    // Step 4: Build summarization prompt
    const userPrompt = buildSummarizationPrompt(
      body.taskDescription,
      body.toolCalls,
      body.lastResponse
    );

    console.log(`[LLM-Summarize] Generating summary for user ${userId}`);

    // Step 5: Call OpenRouter API with summarization model
    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        ...OPENROUTER_HEADERS,
      },
      body: JSON.stringify({
        model: DEFAULT_SUMMARIZATION_MODEL,
        messages: [
          {
            role: 'system',
            content: SUMMARIZATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.3, // Lower temperature for more consistent summaries
      }),
    });

    // Parse response
    const result = await openRouterResponse.json();

    // Check for OpenRouter errors
    if (!openRouterResponse.ok || result.error) {
      const errorMsg = result.error?.message || `OpenRouter error: ${openRouterResponse.status}`;
      console.error(`[LLM-Summarize] OpenRouter error:`, errorMsg);

      await logUsage(supabase, {
        user_id: userId,
        request_type: 'llm_summarize',
        model: DEFAULT_SUMMARIZATION_MODEL,
        provider: 'openrouter',
        success: false,
        error_message: errorMsg,
      });

      return jsonResponse(result, openRouterResponse.status);
    }

    // Step 6: Extract summary and usage
    const summary = result.choices?.[0]?.message?.content || '';
    const usage = result.usage || {};
    const tokensUsed = usage.total_tokens || 0;

    // Update quotas
    if (tokensUsed > 0) {
      await updateTokenUsage(supabase, userId, tokensUsed);
    }
    await incrementFallbackUsage(supabase, userId);

    // Step 7: Log successful usage
    // Gemini Flash is very cheap (~$0.075 per 1M tokens)
    const costPerMToken = 0.000075;
    const estimatedCost = (tokensUsed / 1_000_000) * costPerMToken;

    await logUsage(supabase, {
      user_id: userId,
      request_type: 'llm_summarize',
      model: DEFAULT_SUMMARIZATION_MODEL,
      provider: 'openrouter',
      tokens_input: usage.prompt_tokens || 0,
      tokens_output: usage.completion_tokens || 0,
      tokens_total: tokensUsed,
      cost_usd: estimatedCost,
      success: true,
      metadata: {
        openrouter_id: result.id,
        task_description_length: body.taskDescription.length,
        tool_calls_count: Array.isArray(body.toolCalls)
          ? body.toolCalls.length
          : body.toolCalls.split('\n').length,
      },
    });

    console.log(
      `[LLM-Summarize] Summary generated for user ${userId}. Tokens: ${tokensUsed}`
    );

    // Step 8: Return summary with quota info
    return jsonResponse({
      summary,
      tokens_used: tokensUsed,
      model: DEFAULT_SUMMARIZATION_MODEL,
      _quota: {
        tokens_remaining: Math.max(0, (tokenQuota.remaining?.tokens || 0) - tokensUsed),
        fallbacks_remaining: Math.max(0, (fallbackQuota.remaining?.fallbacks || 0) - 1),
        reset_at: tokenQuota.quota?.reset_at,
      },
    });
  } catch (error) {
    console.error('[LLM-Summarize] Unexpected error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
