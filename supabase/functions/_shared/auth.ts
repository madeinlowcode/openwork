// supabase/functions/_shared/auth.ts

/**
 * @file auth.ts
 * @description Authentication utilities for Supabase Edge Functions
 *
 * @context Jurisiar Backend - Validates JWT tokens and extracts user info
 *
 * @dependencies
 * - @supabase/supabase-js (createClient)
 *
 * @usedBy
 * - supabase/functions/llm-proxy/index.ts
 * - supabase/functions/llm-summarize/index.ts
 *
 * AIDEV-WARNING: Always validate tokens before processing requests
 * AIDEV-SECURITY: Never expose service_role key to clients
 */

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Environment variables required for authentication
 *
 * AIDEV-NOTE: These must be set in Supabase project settings
 */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Result of authentication validation
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  supabase?: SupabaseClient;
}

/**
 * Validate JWT token from Authorization header
 *
 * @param req - Incoming request
 * @returns AuthResult with user info if valid
 *
 * @example
 * const auth = await validateAuth(req);
 * if (!auth.success) {
 *   return errorResponse(auth.error!, 401);
 * }
 * const user = auth.user!;
 *
 * AIDEV-WARNING: Returns service_role client for database operations
 * AIDEV-NOTE: The token is validated against Supabase Auth
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  // Get Authorization header
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header',
    };
  }

  // Extract token
  const token = authHeader.replace('Bearer ', '');

  if (!token || token === authHeader) {
    return {
      success: false,
      error: 'Invalid Authorization header format',
    };
  }

  // Create Supabase client with service role
  // AIDEV-SECURITY: service_role bypasses RLS, use carefully
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Validate the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('[Auth] Token validation error:', authError.message);
      return {
        success: false,
        error: 'Invalid or expired token',
      };
    }

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    return {
      success: true,
      user,
      supabase,
    };
  } catch (error) {
    console.error('[Auth] Unexpected error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Get user ID from request (convenience function)
 *
 * @param req - Incoming request
 * @returns User ID if authenticated, null otherwise
 *
 * @example
 * const userId = await getUserId(req);
 * if (!userId) {
 *   return errorResponse('Unauthorized', 401);
 * }
 */
export async function getUserId(req: Request): Promise<string | null> {
  const auth = await validateAuth(req);
  return auth.success ? auth.user!.id : null;
}
