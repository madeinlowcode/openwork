import { z } from 'zod';

export const taskConfigSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  taskId: z.string().optional(),
  workingDirectory: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  systemPromptAppend: z.string().optional(),
  outputSchema: z.record(z.any()).optional(),
  sessionId: z.string().optional(),
  chrome: z.boolean().optional(),
});

export const permissionResponseSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  decision: z.enum(['allow', 'deny']),
  message: z.string().optional(),
  selectedOptions: z.array(z.string()).optional(),
  customText: z.string().optional(),
});

export const resumeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  existingTaskId: z.string().optional(),
  chrome: z.boolean().optional(),
});

// AIDEV-NOTE: Providers must match ALLOWED_API_KEY_PROVIDERS in handlers.ts
export const ALLOWED_PROVIDERS = [
  'anthropic', 'openai', 'openrouter', 'google', 'xai',
  'deepseek', 'moonshot', 'zai', 'azure-foundry', 'custom',
  'bedrock', 'litellm', 'minimax', 'lmstudio', 'elevenlabs',
] as const;

export const apiKeyStoreSchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  apiKey: z.string().min(1).max(500),
  label: z.string().max(128).optional(),
});

export const apiKeyDeleteSchema = z.object({
  id: z.string().min(1).max(128),
});

export const apiKeySetSchema = z.object({
  key: z.string().min(1).max(500),
});

export const apiKeyValidateProviderSchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  key: z.string().min(1).max(500),
  options: z.record(z.any()).optional(),
});

export const selectedModelSchema = z.object({
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().max(500).optional(),
  deploymentName: z.string().max(200).optional(),
});

export function validate<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues.map((issue: z.ZodIssue) => issue.message).join('; ');
    throw new Error(`Invalid payload: ${message}`);
  }
  return result.data;
}

export function normalizeIpcError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'Unknown IPC error');
}

// ============================================================================
// Auth Token Schema
// ============================================================================

/**
 * Schema para validacao de token de autenticacao armazenado
 * 🔒 AIDEV-SECURITY: Limita tamanho dos tokens para prevenir abuse
 */
export const authStoreTokenSchema = z.object({
  accessToken: z.string().min(1).max(4096),
  refreshToken: z.string().min(1).max(4096),
  expiresAt: z.number().optional(),
});

// ============================================================================
// Auth Schemas (VULN-004)
// ============================================================================

/**
 * Schema para validação de credenciais de login
 * 🔒 AIDEV-SECURITY: Validação rigorosa de inputs
 */
export const authSignInSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

/**
 * Schema para validação de dados de usuário
 * 🔒 AIDEV-SECURITY: Validação rigorosa de inputs
 */
export const authSignUpSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(255).optional(),
});
