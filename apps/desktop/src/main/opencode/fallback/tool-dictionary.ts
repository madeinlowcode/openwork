// apps/desktop/src/main/opencode/fallback/tool-dictionary.ts

/**
 * @file tool-dictionary.ts
 * @description Translates tool calls to human-readable descriptions
 *
 * @context Fallback system - generates readable context for model continuation
 *
 * @dependencies
 * - ./types.ts (ToolCallInfo, TranslatedAction)
 *
 * @relatedFiles
 * - apps/desktop/src/main/opencode/fallback/context-generator.ts (main consumer)
 * - apps/desktop/src/main/opencode/adapter.ts (tool call source)
 *
 * @usedBy
 * - context-generator.ts (generateTemplateContext)
 *
 * AIDEV-NOTE: Templates must be kept in sync with available tools
 * AIDEV-WARNING: Default fallback should handle any unknown tool gracefully
 */

import type { ToolCallInfo, TranslatedAction } from './types';

/**
 * Tool translation template function type
 *
 * AIDEV-NOTE: Receives tool input and returns human-readable description
 */
type ToolTemplate = (input: unknown) => string;

/**
 * Safe property accessor with fallback
 *
 * @param obj - Object to access
 * @param key - Property key
 * @param fallback - Fallback value if property doesn't exist
 * @returns Property value or fallback
 *
 * AIDEV-NOTE: Handles null, undefined, and missing properties safely
 */
function getProperty(obj: unknown, key: string, fallback: string = '[unknown]'): string {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Truncate text to maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated text
 */
function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Tool translation templates
 *
 * AIDEV-NOTE: Maps tool names to translation functions
 * AIDEV-NOTE: Keys are lowercase for case-insensitive matching
 */
const TOOL_TEMPLATES: Record<string, ToolTemplate> = {
  // Browser automation tools (MCP Playwright)
  'browser_navigate': (input) => 
    `Navegou para: ${truncate(getProperty(input, 'url'))}`,
  
  'browser_search': (input) =>
    `Pesquisou: "${truncate(getProperty(input, 'query'))}"`,
  
  'browser_click': (input) =>
    `Clicou em: ${truncate(getProperty(input, 'selector', getProperty(input, 'element', '[elemento]')))}`,
  
  'browser_type': (input) =>
    `Digitou: "${truncate(getProperty(input, 'text', getProperty(input, 'value')))}"`,
  
  'browser_scroll': (input) =>
    `Rolou a página: ${getProperty(input, 'direction', 'down')}`,
  
  'browser_extract': (_input) =>
    'Extraiu dados da página',
  
  'browser_screenshot': (_input) =>
    'Capturou screenshot da página',
  
  'browser_wait': (input) =>
    `Aguardou: ${getProperty(input, 'selector', getProperty(input, 'timeout', '[condição]'))}`,
  
  'browser_close': (_input) =>
    'Fechou o navegador',

  // MCP Playwright tools (alternative naming)
  'mcp_playwright_navigate': (input) =>
    `Playwright: Navegou para ${truncate(getProperty(input, 'url'))}`,
  
  'mcp_playwright_click': (input) =>
    `Playwright: Clicou em ${truncate(getProperty(input, 'selector'))}`,
  
  'mcp_playwright_fill': (input) =>
    `Playwright: Preencheu campo com "${truncate(getProperty(input, 'value'))}"`,
  
  'mcp_playwright_screenshot': (_input) =>
    'Playwright: Capturou screenshot',

  // Web search and fetch tools
  'websearch': (input) =>
    `Buscou na web: "${truncate(getProperty(input, 'query'))}"`,
  
  'webfetch': (input) =>
    `Acessou URL: ${truncate(getProperty(input, 'url'))}`,

  // File operations
  'read_file': (input) =>
    `Leu arquivo: ${truncate(getProperty(input, 'path', getProperty(input, 'file_path')))}`,
  
  'read': (input) =>
    `Leu arquivo: ${truncate(getProperty(input, 'file_path', getProperty(input, 'path')))}`,
  
  'write_file': (input) =>
    `Escreveu arquivo: ${truncate(getProperty(input, 'path', getProperty(input, 'file_path')))}`,
  
  'write': (input) =>
    `Escreveu arquivo: ${truncate(getProperty(input, 'file_path', getProperty(input, 'path')))}`,
  
  'edit': (input) =>
    `Editou arquivo: ${truncate(getProperty(input, 'file_path', getProperty(input, 'path')))}`,
  
  'glob': (input) =>
    `Buscou arquivos: ${truncate(getProperty(input, 'pattern'))}`,
  
  'grep': (input) =>
    `Procurou padrão: "${truncate(getProperty(input, 'pattern'))}"`,

  // Shell/Bash tools
  'bash': (input) =>
    `Executou comando: ${truncate(getProperty(input, 'command'))}`,
  
  'execute_command': (input) =>
    `Executou: ${truncate(getProperty(input, 'command'))}`,
  
  'shell': (input) =>
    `Shell: ${truncate(getProperty(input, 'command'))}`,

  // Notebook tools
  'notebookedit': (input) =>
    `Editou notebook: célula ${getProperty(input, 'cell_number', getProperty(input, 'cell_id', '[?]'))}`,

  // Task/Agent tools
  'task': (input) =>
    `Delegou tarefa: "${truncate(getProperty(input, 'description', getProperty(input, 'task')))}"`,
  
  'agent': (input) =>
    `Agente: ${truncate(getProperty(input, 'task', getProperty(input, 'prompt')))}`,

  // Supabase tools
  'mcp_supabase_query': (input) =>
    `Supabase: Consultou ${truncate(getProperty(input, 'table', '[tabela]'))}`,
  
  'mcp_supabase_insert': (input) =>
    `Supabase: Inseriu em ${truncate(getProperty(input, 'table'))}`,
  
  'mcp_supabase_update': (input) =>
    `Supabase: Atualizou ${truncate(getProperty(input, 'table'))}`,
  
  'mcp_supabase_delete': (input) =>
    `Supabase: Deletou de ${truncate(getProperty(input, 'table'))}`,

  // Memory/Context tools
  'todoread': (_input) =>
    'Leu lista de tarefas',
  
  'todowrite': (input) =>
    `Atualizou tarefas: ${truncate(getProperty(input, 'todos', '[tarefas]'))}`,

  // Sequential thinking
  'sequential_thinking': (input) =>
    `Pensou: "${truncate(getProperty(input, 'thought', '[raciocínio]'))}"`,
};

/**
 * Normalize tool name for lookup
 *
 * @param toolName - Original tool name
 * @returns Normalized tool name (lowercase, cleaned)
 *
 * AIDEV-NOTE: Handles various naming conventions (snake_case, camelCase, etc.)
 */
function normalizeToolName(toolName: string): string {
  return toolName
    .toLowerCase()
    .replace(/^mcp_[a-z]+_/, 'mcp_$1_') // Normalize MCP prefixes
    .replace(/-/g, '_'); // Convert kebab-case to snake_case
}

/**
 * Find matching template for a tool
 *
 * @param toolName - Tool name to match
 * @returns Template function or null if not found
 *
 * AIDEV-NOTE: Tries exact match first, then normalized, then partial
 */
function findTemplate(toolName: string): ToolTemplate | null {
  const normalized = normalizeToolName(toolName);
  
  // Exact match (case-insensitive)
  if (TOOL_TEMPLATES[normalized]) {
    return TOOL_TEMPLATES[normalized];
  }
  
  // Try without mcp_ prefix
  const withoutMcp = normalized.replace(/^mcp_[a-z]+_/, '');
  if (TOOL_TEMPLATES[withoutMcp]) {
    return TOOL_TEMPLATES[withoutMcp];
  }
  
  // Partial match for MCP tools (e.g., mcp_playwright_anything)
  if (normalized.startsWith('mcp_playwright_')) {
    const action = normalized.replace('mcp_playwright_', '');
    return (_input) => `Playwright: ${action.replace(/_/g, ' ')}`;
  }
  
  if (normalized.startsWith('mcp_supabase_')) {
    const action = normalized.replace('mcp_supabase_', '');
    return (_input) => `Supabase: ${action.replace(/_/g, ' ')}`;
  }
  
  return null;
}

/**
 * Translate a single tool call to human-readable text
 *
 * @param toolName - Name of the tool
 * @param toolInput - Input parameters of the tool
 * @returns Human-readable description of the action
 *
 * @example
 * const description = translateToolCall('browser_navigate', { url: 'https://example.com' });
 * // Returns: "Navegou para: https://example.com"
 *
 * AIDEV-NOTE: Returns generic description if tool not in dictionary
 */
export function translateToolCall(toolName: string, toolInput: unknown): string {
  const template = findTemplate(toolName);
  
  if (template) {
    try {
      return template(toolInput);
    } catch {
      // Fallback if template fails
      return `Executou: ${toolName}`;
    }
  }
  
  // Default translation for unknown tools
  return `Executou: ${toolName}`;
}

/**
 * Translate multiple tool calls to human-readable descriptions
 *
 * @param calls - Array of tool calls to translate
 * @returns Array of human-readable descriptions
 *
 * @example
 * const descriptions = translateToolCalls([
 *   { tool_name: 'browser_navigate', tool_input: { url: 'https://example.com' } },
 *   { tool_name: 'browser_click', tool_input: { selector: '#submit' } }
 * ]);
 * // Returns: ["Navegou para: https://example.com", "Clicou em: #submit"]
 *
 * AIDEV-NOTE: Preserves order of tool calls
 */
export function translateToolCalls(
  calls: Array<{ tool_name: string; tool_input: unknown }>
): string[] {
  return calls.map((call) => translateToolCall(call.tool_name, call.tool_input));
}

/**
 * Translate tool calls with full action info
 *
 * @param calls - Array of tool call info objects
 * @returns Array of translated actions with metadata
 *
 * @example
 * const actions = translateToolCallsWithInfo([
 *   { tool_name: 'read_file', tool_input: { path: '/src/index.ts' } }
 * ]);
 * // Returns: [{ toolName: 'read_file', description: 'Leu arquivo: /src/index.ts' }]
 *
 * AIDEV-NOTE: Use this when you need both original tool name and description
 */
export function translateToolCallsWithInfo(
  calls: ToolCallInfo[]
): TranslatedAction[] {
  return calls.map((call) => ({
    toolName: call.tool_name,
    description: translateToolCall(call.tool_name, call.tool_input),
  }));
}

/**
 * Check if a tool is in the known dictionary
 *
 * @param toolName - Tool name to check
 * @returns True if tool has a specific template
 *
 * AIDEV-NOTE: Useful for statistics and coverage reporting
 */
export function isKnownTool(toolName: string): boolean {
  return findTemplate(toolName) !== null;
}

/**
 * Get list of all known tool names
 *
 * @returns Array of known tool names
 *
 * AIDEV-NOTE: Useful for documentation and debugging
 */
export function getKnownToolNames(): string[] {
  return Object.keys(TOOL_TEMPLATES);
}
