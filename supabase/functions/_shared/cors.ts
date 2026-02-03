// supabase/functions/_shared/cors.ts

/**
 * @file cors.ts
 * @description CORS headers configuration for Supabase Edge Functions
 *
 * @context Jurisiar Backend - Shared utilities for Edge Functions
 *
 * @usedBy
 * - supabase/functions/llm-proxy/index.ts
 * - supabase/functions/llm-summarize/index.ts
 *
 * AIDEV-NOTE: These headers allow requests from any origin
 * AIDEV-SECURITY: In production, consider restricting to specific origins
 */

/**
 * Standard CORS headers for Edge Functions
 *
 * @description Allows cross-origin requests with authorization headers
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Handle CORS preflight request
 *
 * @returns Response for OPTIONS request
 *
 * @example
 * if (req.method === 'OPTIONS') {
 *   return handleCorsPrelight();
 * }
 */
export function handleCorsPreflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Create JSON response with CORS headers
 *
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response with JSON body and CORS headers
 *
 * @example
 * return jsonResponse({ success: true, data: result });
 * return jsonResponse({ error: 'Not found' }, 404);
 */
export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create error response with CORS headers
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @returns Response with error JSON and CORS headers
 *
 * @example
 * return errorResponse('Unauthorized', 401);
 * return errorResponse('Quota exceeded', 429);
 */
export function errorResponse(message: string, status: number = 500): Response {
  return jsonResponse({ error: message }, status);
}
