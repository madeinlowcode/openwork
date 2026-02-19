// apps/desktop/src/main/opencode/fallback/context-generator.ts

/**
 * @file context-generator.ts
 * @description Generates continuation context for fallback models
 *
 * @context Fallback system - creates context summarizing previous progress
 *
 * @dependencies
 * - @accomplish/shared (TaskMessage)
 * - ./types.ts (ContextGeneratorOptions, ContextGenerationResult)
 * - ./tool-dictionary.ts (translateToolCall)
 * - ../../supabase/edge-client.ts (callLLMSummarize, canCallEdgeFunctions)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/fallback/fallback-engine.ts (main consumer)
 * - apps/desktop/src/main/opencode/adapter.ts (message source)
 * - supabase/functions/llm-summarize/index.ts (Edge Function de sumarizacao)
 *
 * @usedBy
 * - fallback-engine.ts (handleError method)
 *
 * AIDEV-NOTE: Two modes - template (free) and LLM (paid, more accurate)
 * AIDEV-WARNING: LLM mode requires valid auth token and Supabase connection
 * AIDEV-WARNING: LLM mode consumes tokens from user quota
 */

import type { TaskMessage } from '@accomplish/shared';
import type { ContextGeneratorOptions, ContextGenerationResult } from './types';
import { translateToolCall } from './tool-dictionary';
import { callLLMSummarize, canCallEdgeFunctions } from '../../supabase/edge-client';

/**
 * Estimated tokens per character for context size estimation
 *
 * AIDEV-NOTE: Conservative estimate (1 token ≈ 4 chars for English)
 */
const TOKENS_PER_CHAR = 0.25;

/**
 * Maximum characters for last response excerpt
 */
const MAX_LAST_RESPONSE_CHARS = 2000;

/**
 * Maximum number of actions to include in context
 */
const MAX_ACTIONS_IN_CONTEXT = 30;

/**
 * Maximum tokens for LLM summarization output
 *
 * AIDEV-NOTE: Keeps summaries concise and cost-effective
 */
const LLM_SUMMARY_MAX_TOKENS = 300;

/**
 * Estimate token count from text length
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * AIDEV-NOTE: This is a rough estimate, actual tokens may vary by model
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

/**
 * Maximum characters for tool output excerpt included in actions
 */
const MAX_TOOL_OUTPUT_CHARS = 300;

/**
 * Tool names that modify files (used to extract modified file paths)
 *
 * AIDEV-NOTE: Keys are lowercase for matching against normalized tool names
 */
const FILE_MODIFYING_TOOLS = new Set([
  'write', 'write_file', 'edit', 'create_text_file', 'create_file',
  'mcp_plugin_serena_serena_create_text_file', 'mcp_plugin_serena_serena_replace_content',
  'mcp_plugin_serena_serena_replace_symbol_body',
]);

/**
 * Extract tool actions from messages, including tool output summaries
 *
 * @param messages - Task messages to analyze
 * @returns Array of action descriptions with output context
 *
 * AIDEV-NOTE: Includes truncated tool output for richer context
 */
function extractActions(messages: TaskMessage[]): string[] {
  const actions: string[] = [];

  for (const msg of messages) {
    if (msg.type === 'tool' && msg.toolName) {
      const description = translateToolCall(msg.toolName, msg.toolInput);
      let entry = description;

      // Include tool output if available (from content field)
      if (msg.content && msg.content.length > 0) {
        const outputPreview = truncateText(msg.content, MAX_TOOL_OUTPUT_CHARS);
        entry += `\n   Output: ${outputPreview}`;
      }

      actions.push(entry);
    }
  }

  // Limit to most recent actions if too many
  if (actions.length > MAX_ACTIONS_IN_CONTEXT) {
    const skipped = actions.length - MAX_ACTIONS_IN_CONTEXT;
    return [
      `... (${skipped} acoes anteriores omitidas)`,
      ...actions.slice(-MAX_ACTIONS_IN_CONTEXT),
    ];
  }

  return actions;
}

/**
 * Extract file paths modified by tool calls
 *
 * @param messages - Task messages to analyze
 * @returns Deduplicated array of file paths
 *
 * AIDEV-NOTE: Checks write, edit, create tools for file_path or path properties
 */
function extractModifiedFiles(messages: TaskMessage[]): string[] {
  const files = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'tool' && msg.toolName && msg.toolInput) {
      const normalized = msg.toolName.toLowerCase().replace(/-/g, '_');
      if (FILE_MODIFYING_TOOLS.has(normalized)) {
        const input = msg.toolInput as Record<string, unknown>;
        const filePath = input.file_path || input.path || input.relative_path;
        if (typeof filePath === 'string' && filePath.length > 0) {
          files.add(filePath);
        }
      }
    }
  }

  return Array.from(files);
}

/**
 * Extract TODO items from assistant messages
 *
 * @param messages - Task messages to search
 * @returns Array of TODO strings found in messages
 *
 * AIDEV-NOTE: Matches common TODO patterns like "TODO:", "- [ ]", "AIDEV-TODO:"
 */
function extractTodos(messages: TaskMessage[]): string[] {
  const todos: string[] = [];
  const todoPattern = /(?:TODO|AIDEV-TODO|FIXME):\s*(.+)/gi;
  const checkboxPattern = /- \[ \]\s*(.+)/g;

  for (const msg of messages) {
    if ((msg.type === 'assistant' || msg.type === 'tool') && msg.content) {
      let match: RegExpExecArray | null;

      todoPattern.lastIndex = 0;
      while ((match = todoPattern.exec(msg.content)) !== null) {
        todos.push(match[1].trim());
      }

      checkboxPattern.lastIndex = 0;
      while ((match = checkboxPattern.exec(msg.content)) !== null) {
        todos.push(match[1].trim());
      }
    }
  }

  // Deduplicate
  return [...new Set(todos)];
}

/**
 * Get last assistant response from messages
 *
 * @param messages - Task messages to search
 * @returns Last assistant message content or null
 *
 * AIDEV-NOTE: Searches from end of array for efficiency
 */
function getLastAssistantResponse(messages: TaskMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'assistant' && msg.content) {
      return msg.content;
    }
  }
  return null;
}

/**
 * Truncate text with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format actions as string for LLM input
 *
 * @param actions - Array of action descriptions
 * @returns Formatted string with numbered actions
 *
 * AIDEV-NOTE: Used to prepare tool calls for Edge Function
 */
function formatActionsForLLM(actions: string[]): string {
  if (actions.length === 0) {
    return 'Nenhuma acao registrada';
  }
  return actions.map((action, index) => `${index + 1}. ${action}`).join('\n');
}

/**
 * Generate context using template method (free)
 *
 * @param originalPrompt - Original user task prompt
 * @param messages - Messages from the task session
 * @returns Context string for continuation
 *
 * AIDEV-NOTE: No API calls, uses predefined template structure
 */
function generateTemplateContext(
  originalPrompt: string,
  messages: TaskMessage[]
): string {
  const actions = extractActions(messages);
  const lastResponse = getLastAssistantResponse(messages);
  const modifiedFiles = extractModifiedFiles(messages);
  const todos = extractTodos(messages);

  let context = `## Tarefa Original\n${originalPrompt}\n\n`;

  if (actions.length > 0) {
    context += `## Progresso Anterior\n`;
    context += `As seguintes acoes ja foram realizadas:\n`;
    actions.forEach((action, index) => {
      context += `${index + 1}. ${action}\n`;
    });
    context += '\n';
  }

  if (modifiedFiles.length > 0) {
    context += `## Arquivos Modificados\n`;
    modifiedFiles.forEach((file) => {
      context += `- ${file}\n`;
    });
    context += '\n';
  }

  if (todos.length > 0) {
    context += `## TODOs Pendentes\n`;
    todos.forEach((todo) => {
      context += `- ${todo}\n`;
    });
    context += '\n';
  }

  if (lastResponse) {
    const truncated = truncateText(lastResponse, MAX_LAST_RESPONSE_CHARS);
    context += `## Ultima Resposta\n${truncated}\n\n`;
  }

  context += `## Instrucao\n`;
  context += `A tarefa foi interrompida por limite de requisicoes do modelo anterior. `;
  context += `Continue esta tarefa de onde parou. `;
  context += `Nao repita as acoes ja realizadas listadas acima. `;
  context += `Se precisar verificar o estado atual, faca-o antes de prosseguir.\n`;

  return context;
}

/**
 * Generate context using LLM summarization (paid)
 *
 * @param originalPrompt - Original user task prompt
 * @param messages - Messages from the task session
 * @param _options - Generator options with LLM configuration (used for logging)
 * @returns Promise resolving to context string
 *
 * AIDEV-NOTE: Calls Edge Function llm-summarize for intelligent summarization
 * AIDEV-WARNING: Consumes tokens from user quota
 * AIDEV-WARNING: Falls back to template if LLM call fails
 */
async function generateLLMContext(
  originalPrompt: string,
  messages: TaskMessage[],
  _options: ContextGeneratorOptions
): Promise<{ context: string; usedLLM: boolean }> {
  // Verificar se podemos fazer chamadas ao backend
  if (!canCallEdgeFunctions()) {
    console.warn(
      '[ContextGenerator] Cannot call Edge Functions - not authenticated or Supabase not configured. ' +
      'Falling back to template mode.'
    );
    return {
      context: generateTemplateContext(originalPrompt, messages),
      usedLLM: false,
    };
  }

  // Preparar dados para a Edge Function
  const actions = extractActions(messages);
  const toolCallsText = formatActionsForLLM(actions);
  const lastResponse = getLastAssistantResponse(messages);

  try {
    console.log('[ContextGenerator] Calling llm-summarize Edge Function...');

    const result = await callLLMSummarize({
      taskDescription: originalPrompt,
      toolCalls: toolCallsText,
      lastResponse: lastResponse ? truncateText(lastResponse, MAX_LAST_RESPONSE_CHARS) : undefined,
      maxTokens: LLM_SUMMARY_MAX_TOKENS,
    });

    if (result.success && result.data?.summary) {
      console.log(
        `[ContextGenerator] LLM summarization successful. ` +
        `Tokens used: ${result.data.tokens_used}, Model: ${result.data.model}`
      );

      // Construir contexto com resumo do LLM
      let context = `## Tarefa Original\n${originalPrompt}\n\n`;
      context += `## Resumo do Progresso\n${result.data.summary}\n\n`;
      context += `## Instrucao\n`;
      context += `A tarefa foi interrompida por limite de requisicoes do modelo anterior. `;
      context += `Continue esta tarefa com base no resumo acima. `;
      context += `Nao repita acoes ja realizadas.\n`;

      // Log quota info se disponivel
      if (result.data._quota) {
        console.log(
          `[ContextGenerator] Quota remaining - ` +
          `Tokens: ${result.data._quota.tokens_remaining}, ` +
          `Fallbacks: ${result.data._quota.fallbacks_remaining}`
        );
      }

      return {
        context,
        usedLLM: true,
      };
    }

    // LLM call retornou erro - fazer fallback para template
    console.warn(
      `[ContextGenerator] LLM summarization failed: ${result.error || 'Unknown error'}. ` +
      `Status: ${result.statusCode}. Falling back to template mode.`
    );

    return {
      context: generateTemplateContext(originalPrompt, messages),
      usedLLM: false,
    };
  } catch (error) {
    // Erro inesperado - fazer fallback para template
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[ContextGenerator] Unexpected error during LLM summarization: ${errorMsg}. ` +
      'Falling back to template mode.'
    );

    return {
      context: generateTemplateContext(originalPrompt, messages),
      usedLLM: false,
    };
  }
}

/**
 * Generate continuation context for fallback model
 *
 * @param originalPrompt - Original user task prompt
 * @param messages - Messages from the task session
 * @param options - Context generation options
 * @returns Promise resolving to context generation result
 *
 * @example
 * const result = await generateContinuationContext(
 *   'Pesquise sobre React hooks',
 *   taskMessages,
 *   { useLLM: false }
 * );
 * console.log(result.context);
 *
 * AIDEV-NOTE: Chooses between template and LLM based on options.useLLM
 * AIDEV-WARNING: LLM mode may fall back to template if call fails
 */
export async function generateContinuationContext(
  originalPrompt: string,
  messages: TaskMessage[],
  options: ContextGeneratorOptions
): Promise<ContextGenerationResult> {
  let context: string;
  let method: 'template' | 'llm';

  if (options.useLLM) {
    // Tentar usar LLM para sumarizacao
    // AIDEV-NOTE: Nao requer mais llmModelId/llmProvider - Edge Function usa modelo padrao
    const llmResult = await generateLLMContext(originalPrompt, messages, options);
    context = llmResult.context;
    method = llmResult.usedLLM ? 'llm' : 'template';
  } else {
    // Usar template (gratuito)
    context = generateTemplateContext(originalPrompt, messages);
    method = 'template';
  }

  // Apply token limit if specified
  if (options.maxTokens) {
    const maxChars = Math.floor(options.maxTokens / TOKENS_PER_CHAR);
    if (context.length > maxChars) {
      context = truncateText(context, maxChars);
    }
  }

  const tokenCount = estimateTokens(context);

  return {
    context,
    method,
    tokenCount,
  };
}

/**
 * Generate minimal context for quick fallback
 *
 * @param originalPrompt - Original user task prompt
 * @param messages - Messages from the task session
 * @returns Minimal context string
 *
 * AIDEV-NOTE: Use when token budget is very limited
 */
export function generateMinimalContext(
  originalPrompt: string,
  messages: TaskMessage[]
): string {
  const actions = extractActions(messages);
  const recentActions = actions.slice(-5); // Only last 5 actions

  let context = `Tarefa: ${truncateText(originalPrompt, 200)}\n\n`;

  if (recentActions.length > 0) {
    context += `Acoes recentes:\n`;
    recentActions.forEach((action) => {
      context += `- ${action}\n`;
    });
  }

  context += `\nContinue de onde parou. Nao repita acoes.`;

  return context;
}

/**
 * Calculate context statistics
 *
 * @param messages - Messages to analyze
 * @returns Statistics about the messages
 *
 * AIDEV-NOTE: Useful for deciding between context generation modes
 */
export function getContextStats(messages: TaskMessage[]): {
  totalMessages: number;
  toolCalls: number;
  assistantMessages: number;
  estimatedTokens: number;
} {
  let toolCalls = 0;
  let assistantMessages = 0;
  let totalChars = 0;

  for (const msg of messages) {
    if (msg.type === 'tool') {
      toolCalls++;
    } else if (msg.type === 'assistant') {
      assistantMessages++;
    }
    totalChars += (msg.content || '').length;
  }

  return {
    totalMessages: messages.length,
    toolCalls,
    assistantMessages,
    estimatedTokens: estimateTokens(String(totalChars)),
  };
}

/**
 * Check if LLM summarization is available
 *
 * @returns boolean indicating if LLM summarization can be used
 *
 * AIDEV-NOTE: Useful for UI to show/hide LLM option
 */
export function isLLMSummarizationAvailable(): boolean {
  return canCallEdgeFunctions();
}
