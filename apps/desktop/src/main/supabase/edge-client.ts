// apps/desktop/src/main/supabase/edge-client.ts

/**
 * @module edge-client
 * @description Cliente HTTP para chamar Edge Functions do Supabase
 *
 * @context Main process - comunicacao com backend Supabase
 *
 * @dependencies
 * - ../store/secureStorage.ts (getAuthToken)
 * - ../config.ts (getDesktopConfig)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/fallback/context-generator.ts (principal consumidor)
 * - supabase/functions/llm-summarize/index.ts (Edge Function de sumarizacao)
 * - apps/desktop/src/main/store/secureStorage.ts (autenticacao)
 *
 * @usedBy
 * - context-generator.ts (generateLLMContext)
 *
 * AIDEV-WARNING: Todas as chamadas requerem auth token valido do Supabase
 * AIDEV-SECURITY: Nunca logar tokens, respostas sensiveis ou dados do usuario
 * AIDEV-NOTE: Fallback gracioso para template mode se chamada falhar
 */

import { getAuthToken } from '../store/secureStorage';
import { getDesktopConfig } from '../config';

/**
 * Resposta generica de Edge Function
 *
 * @template T - Tipo dos dados retornados
 *
 * AIDEV-NOTE: success=false indica erro, data e undefined neste caso
 */
export interface EdgeFunctionResponse<T> {
  /** Indica se a chamada foi bem-sucedida */
  success: boolean;
  /** Dados retornados pela Edge Function (se success=true) */
  data?: T;
  /** Mensagem de erro (se success=false) */
  error?: string;
  /** Codigo de status HTTP */
  statusCode?: number;
}

/**
 * Resposta da Edge Function llm-summarize
 *
 * AIDEV-NOTE: Estrutura retornada pela supabase/functions/llm-summarize/index.ts
 */
export interface LLMSummarizeResponse {
  /** Resumo gerado pelo LLM */
  summary: string;
  /** Quantidade de tokens utilizados */
  tokens_used: number;
  /** Modelo usado para sumarizacao */
  model: string;
  /** Informacoes de quota do usuario */
  _quota?: {
    tokens_remaining: number;
    fallbacks_remaining: number;
    reset_at?: string;
  };
}

/**
 * Payload para chamada da Edge Function llm-summarize
 *
 * AIDEV-NOTE: Campos opcionais tem valores default na Edge Function
 */
export interface LLMSummarizePayload {
  /** Descricao original da tarefa */
  taskDescription: string;
  /** Lista de tool calls realizadas (string ou array) */
  toolCalls: string | string[];
  /** Ultima resposta do assistente (opcional) */
  lastResponse?: string;
  /** Maximo de tokens para o resumo (default: 300) */
  maxTokens?: number;
}

/**
 * Timeout padrao para chamadas de Edge Function (30 segundos)
 *
 * AIDEV-PERF: Timeout generoso para acomodar latencia de LLM
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Chama uma Edge Function do Supabase
 *
 * @template T - Tipo esperado da resposta
 * @param functionName - Nome da Edge Function (ex: 'llm-summarize')
 * @param body - Payload da requisicao
 * @param timeoutMs - Timeout em milissegundos (default: 30000)
 * @returns Promise com resultado da chamada
 *
 * @example
 * const result = await callEdgeFunction<MyResponse>('my-function', { data: 'test' });
 * if (result.success) {
 *   console.log(result.data);
 * }
 *
 * AIDEV-WARNING: Requer autenticacao - retorna erro se nao autenticado
 * AIDEV-SECURITY: Token e passado via header Authorization Bearer
 */
export async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<EdgeFunctionResponse<T>> {
  // Obter configuracao
  let config;
  try {
    config = getDesktopConfig();
  } catch (configError) {
    console.error('[EdgeClient] Failed to get config:', configError);
    return {
      success: false,
      error: 'Configuration not available',
      statusCode: 500,
    };
  }

  // Verificar se Supabase URL esta configurada
  if (!config.supabaseUrl) {
    console.warn('[EdgeClient] Supabase URL not configured');
    return {
      success: false,
      error: 'Supabase not configured',
      statusCode: 503,
    };
  }

  // Obter token de autenticacao
  // AIDEV-NOTE: getAuthToken() e sincrono - retorna token armazenado localmente
  let token;
  try {
    token = getAuthToken();
  } catch (authError) {
    console.error('[EdgeClient] Failed to get auth token:', authError);
    return {
      success: false,
      error: 'Authentication error',
      statusCode: 401,
    };
  }

  if (!token || !token.accessToken) {
    console.warn('[EdgeClient] Not authenticated - no valid token');
    return {
      success: false,
      error: 'Not authenticated',
      statusCode: 401,
    };
  }

  // Construir URL da Edge Function
  const url = `${config.supabaseUrl}/functions/v1/${functionName}`;

  // Criar AbortController para timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[EdgeClient] Calling Edge Function: ${functionName}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Tentar parsear resposta como JSON
    let responseData: T | { error?: string };
    try {
      responseData = await response.json();
    } catch {
      // Se nao for JSON, usar texto como erro
      const textResponse = await response.text();
      return {
        success: false,
        error: textResponse || `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    // Verificar status HTTP
    if (!response.ok) {
      const errorMsg = (responseData as { error?: string }).error ||
        `Edge Function error: ${response.status}`;

      console.warn(`[EdgeClient] Edge Function ${functionName} returned ${response.status}:`, errorMsg);

      return {
        success: false,
        error: errorMsg,
        statusCode: response.status,
      };
    }

    console.log(`[EdgeClient] Edge Function ${functionName} completed successfully`);

    return {
      success: true,
      data: responseData as T,
      statusCode: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Tratamento de erro de abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[EdgeClient] Edge Function ${functionName} timed out after ${timeoutMs}ms`);
      return {
        success: false,
        error: 'Request timed out',
        statusCode: 408,
      };
    }

    // Tratamento de erro de rede
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`[EdgeClient] Network error calling ${functionName}:`, error.message);
      return {
        success: false,
        error: 'Network error - unable to reach server',
        statusCode: 0,
      };
    }

    // Erro generico
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EdgeClient] Error calling ${functionName}:`, errorMsg);

    return {
      success: false,
      error: errorMsg,
      statusCode: 500,
    };
  }
}

/**
 * Chama a Edge Function llm-summarize para gerar resumo de contexto
 *
 * @param payload - Dados para sumarizacao
 * @returns Promise com resultado contendo resumo ou erro
 *
 * @example
 * const result = await callLLMSummarize({
 *   taskDescription: 'Criar componente React',
 *   toolCalls: '1. Leu arquivo X\n2. Editou arquivo Y',
 *   lastResponse: 'Vou criar o componente...',
 * });
 *
 * if (result.success && result.data) {
 *   console.log('Resumo:', result.data.summary);
 * }
 *
 * AIDEV-NOTE: Usado pelo ContextGenerator quando useLLMSummarization=true
 * AIDEV-WARNING: Consome tokens da quota do usuario
 * AIDEV-PERF: Usa modelo barato (Gemini Flash) para custo minimo
 */
export async function callLLMSummarize(
  payload: LLMSummarizePayload
): Promise<EdgeFunctionResponse<LLMSummarizeResponse>> {
  // Validar campos obrigatorios
  if (!payload.taskDescription || typeof payload.taskDescription !== 'string') {
    return {
      success: false,
      error: 'taskDescription is required',
      statusCode: 400,
    };
  }

  if (payload.toolCalls === undefined || payload.toolCalls === null) {
    return {
      success: false,
      error: 'toolCalls is required',
      statusCode: 400,
    };
  }

  // Construir body da requisicao
  const body: Record<string, unknown> = {
    taskDescription: payload.taskDescription,
    toolCalls: payload.toolCalls,
  };

  // Adicionar campos opcionais se presentes
  if (payload.lastResponse) {
    body.lastResponse = payload.lastResponse;
  }

  if (payload.maxTokens !== undefined) {
    body.maxTokens = payload.maxTokens;
  }

  return callEdgeFunction<LLMSummarizeResponse>('llm-summarize', body);
}

/**
 * Verifica se o cliente pode fazer chamadas (tem configuracao e token)
 *
 * @returns Promise<boolean> indicando se chamadas sao possiveis
 *
 * AIDEV-NOTE: Util para verificar antes de tentar usar modo LLM
 */
export function canCallEdgeFunctions(): boolean {
  try {
    const config = getDesktopConfig();
    if (!config.supabaseUrl) {
      return false;
    }

    // AIDEV-NOTE: getAuthToken() e sincrono
    const token = getAuthToken();
    return !!(token && token.accessToken);
  } catch {
    return false;
  }
}
