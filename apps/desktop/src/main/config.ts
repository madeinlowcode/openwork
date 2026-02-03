/**
 * @module config
 * @description Configuracao do aplicativo desktop Jurisiar
 *
 * @context Main process - configuracoes globais do app
 *
 * @dependencies
 * - zod (validacao de schema)
 *
 * @relatedFiles
 * - ipc/handlers.ts (usa getDesktopConfig para obter URLs)
 * - .env (variaveis de ambiente)
 *
 * AIDEV-WARNING: URLs sensiveis devem vir de variaveis de ambiente
 * AIDEV-NOTE: Supabase config e necessaria para autenticacao
 * AIDEV-SECURITY: Nunca expor service_role_key - apenas anon key
 */

import { z } from 'zod';

const PRODUCTION_API_URL = 'https://lite.accomplish.ai';

// AIDEV-NOTE: Schema de configuracao do desktop
// AIDEV-WARNING: Adicionar novas configs aqui com valores default seguros
const desktopConfigSchema = z.object({
  apiUrl: z
    .string()
    .url()
    .default(PRODUCTION_API_URL),
  // AIDEV-NOTE: Supabase config para autenticacao
  // AIDEV-WARNING: Estes valores devem ser configurados via variaveis de ambiente
  supabaseUrl: z
    .string()
    .url()
    .optional()
    .default(''),
  supabaseAnonKey: z
    .string()
    .optional()
    .default(''),
});

type DesktopConfig = z.infer<typeof desktopConfigSchema>;

let cachedConfig: DesktopConfig | null = null;

/**
 * Obtem a configuracao do desktop
 *
 * @returns Configuracao validada
 * @throws Error se configuracao for invalida
 *
 * AIDEV-NOTE: Configuracao e cacheada apos primeira chamada
 */
export function getDesktopConfig(): DesktopConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = desktopConfigSchema.safeParse({
    apiUrl: process.env.ACCOMPLISH_API_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue: z.ZodIssue) => issue.message).join('; ');
    throw new Error(`Invalid desktop configuration: ${message}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}
