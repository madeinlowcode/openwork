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
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/fallback/fallback-engine.ts (main consumer)
 * - apps/desktop/src/main/opencode/adapter.ts (message source)
 *
 * @usedBy
 * - fallback-engine.ts (handleError method)
 *
 * AIDEV-NOTE: Two modes - template (free) and LLM (paid, more accurate)
 * AIDEV-WARNING: LLM mode requires valid API key for summarization model
 */

import type { TaskMessage } from '@accomplish/shared';
import type { ContextGeneratorOptions, ContextGenerationResult } from './types';
import { translateToolCall } from './tool-dictionary';

/**
 * Estimated tokens per character for context size estimation
 *
 * AIDEV-NOTE: Conservative estimate (1 token ≈ 4 chars for English)
 */
const TOKENS_PER_CHAR = 0.25;

/**
 * Maximum characters for last response excerpt
 */
const MAX_LAST_RESPONSE_CHARS = 500;

/**
 * Maximum number of actions to include in context
 */
const MAX_ACTIONS_IN_CONTEXT = 20;

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
 * Extract tool actions from messages
 *
 * @param messages - Task messages to analyze
 * @returns Array of action descriptions
 *
 * AIDEV-NOTE: Filters for tool messages and translates them
 */
function extractActions(messages: TaskMessage[]): string[] {
  const actions: string[] = [];
  
  for (const msg of messages) {
    if (msg.type === 'tool' && msg.toolName) {
      const description = translateToolCall(msg.toolName, msg.toolInput);
      actions.push(description);
    }
  }
  
  // Limit to most recent actions if too many
  if (actions.length > MAX_ACTIONS_IN_CONTEXT) {
    const skipped = actions.length - MAX_ACTIONS_IN_CONTEXT;
    return [
      `... (${skipped} ações anteriores omitidas)`,
      ...actions.slice(-MAX_ACTIONS_IN_CONTEXT),
    ];
  }
  
  return actions;
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
  
  let context = `## Tarefa Original\n${originalPrompt}\n\n`;
  
  if (actions.length > 0) {
    context += `## Progresso Anterior\n`;
    context += `As seguintes ações já foram realizadas:\n`;
    actions.forEach((action, index) => {
      context += `${index + 1}. ${action}\n`;
    });
    context += '\n';
  }
  
  if (lastResponse) {
    const truncated = truncateText(lastResponse, MAX_LAST_RESPONSE_CHARS);
    context += `## Última Resposta\n${truncated}\n\n`;
  }
  
  context += `## Instrução\n`;
  context += `A tarefa foi interrompida por limite de requisições do modelo anterior. `;
  context += `Continue esta tarefa de onde parou. `;
  context += `Não repita as ações já realizadas listadas acima. `;
  context += `Se precisar verificar o estado atual, faça-o antes de prosseguir.\n`;
  
  return context;
}

/**
 * Generate context using LLM summarization (paid)
 *
 * @param originalPrompt - Original user task prompt
 * @param messages - Messages from the task session
 * @param options - Generator options with LLM configuration
 * @returns Promise resolving to context string
 *
 * AIDEV-NOTE: Makes API call to summarization model
 * AIDEV-WARNING: Requires valid llmModelId and llmProvider
 * AIDEV-TODO: Implement actual LLM call when API integration is ready
 */
async function generateLLMContext(
  originalPrompt: string,
  messages: TaskMessage[],
  options: ContextGeneratorOptions
): Promise<string> {
  // AIDEV-TODO: Implement LLM-based summarization
  // For now, fall back to template with a note
  // 
  // Future implementation should:
  // 1. Build a prompt asking LLM to summarize the conversation
  // 2. Call the summarization model API
  // 3. Return the summarized context
  //
  // Example prompt for LLM:
  // "Resuma o progresso desta tarefa de forma concisa para continuar com outro modelo:
  //  - Tarefa original: {originalPrompt}
  //  - Mensagens: {messages}
  //  - Foque nas ações realizadas e próximos passos"
  
  console.warn(
    '[FallbackEngine] LLM summarization not yet implemented, using template mode. ' +
    `Configured model: ${options.llmModelId}, provider: ${options.llmProvider}`
  );
  
  // Use template as fallback until LLM integration is complete
  let context = generateTemplateContext(originalPrompt, messages);
  
  // Add note about LLM mode intent
  context += `\n(Nota: Modo de sumarização LLM configurado mas usando template temporariamente)\n`;
  
  return context;
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
 */
export async function generateContinuationContext(
  originalPrompt: string,
  messages: TaskMessage[],
  options: ContextGeneratorOptions
): Promise<ContextGenerationResult> {
  let context: string;
  let method: 'template' | 'llm';
  
  if (options.useLLM && options.llmModelId && options.llmProvider) {
    context = await generateLLMContext(originalPrompt, messages, options);
    method = 'llm';
  } else {
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
    context += `Ações recentes:\n`;
    recentActions.forEach((action) => {
      context += `- ${action}\n`;
    });
  }
  
  context += `\nContinue de onde parou. Não repita ações.`;
  
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
