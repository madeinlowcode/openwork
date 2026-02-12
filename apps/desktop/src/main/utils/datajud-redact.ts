/**
 * DataJud Log Redaction Utilities
 *
 * @description Utilities for sanitizing logs to prevent API key exposure
 * @see apps/desktop/src/main/services/datajud.ts
 *
 * @context Security utilities for DataJud integration
 *
 * @dependencies None - standalone utility functions
 *
 * @usedBy
 * - apps/desktop/src/main/services/datajud.ts
 * - apps/desktop/src/main/mcp/datajud-server.ts
 * - apps/desktop/src/main/ipc/datajud-handlers.ts
 *
 * 🔒 AIDEV-SECURITY: Critical - API keys must never appear in logs
 * ⚠️ AIDEV-WARNING: Apply redaction to ALL log statements involving DataJud
 */

/**
 * Redact DataJud API key from log messages
 *
 * @param text - Text that may contain API key
 * @returns Text with API key redacted
 *
 * @example
 * const log = redactDataJudKey(`Request with APIKey ${apiKey}`);
 * // APIKey abc123-def456 -> APIKey [REDACTED]
 */
export function redactDataJudKey(text: string): string {
  // Redact patterns like "APIKey abc123-def456" or "APIKey: abc123-def456"
  return text.replace(/APIKey\s*[:=]?\s*[a-zA-Z0-9\-_]+/gi, 'APIKey [REDACTED]');
}

/**
 * Redact Authorization header from log messages
 *
 * @param text - Text that may contain Authorization header
 * @returns Text with Authorization header redacted
 */
export function redactAuthorizationHeader(text: string): string {
  // Redact various authorization header formats
  return text.replace(
    /(Authorization|Bearer|Token)[:\s]+[a-zA-Z0-9\-_]+/gi,
    '$1 [REDACTED]'
  );
}

/**
 * Redact CPF/CNPJ from a value
 */
function redactCpfCnpj(value: unknown): unknown {
  if (typeof value === 'string') {
    // Redact CPF pattern: XXX.XXX.XXX-XX
    return value.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF REDACTED]')
      // Redact CNPJ pattern: XX.XXX.XXX/XXXX-XX
      .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '[CNPJ REDACTED]');
  }
  if (typeof value === 'object' && value !== null) {
    return redactNestedObject(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Recursively redact nested objects
 */
function redactNestedObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip already processed fields
    if (key === 'partes') {
      result[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value.map((item) => redactCpfCnpj(item));
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactNestedObject(value as Record<string, unknown>);
    } else {
      result[key] = redactCpfCnpj(value);
    }
  }

  return result;
}

/**
 * Redact sensitive process data for logging
 *
 * @param data - Process data that may contain sensitive information
 * @returns Sanitized process data for logging
 *
 * @example
 * const logData = redactProcessForLog({
 *   numeroProcesso: '0000000-00.0000.0.00.0000',
 *   partes: [{ nome: 'John Doe', documento: '123.456.789-00' }],
 *   nivelSigilo: 0
 * });
 */
export function redactProcessForLog(data: Record<string, unknown>): Record<string, unknown> {
  // Deep clone to avoid mutating original
  const sanitized = { ...data };

  // Redact sensitive fields if present
  if ('partes' in sanitized && Array.isArray(sanitized.partes)) {
    sanitized.partes = sanitized.partes.map((party: unknown) => {
      if (typeof party === 'object' && party !== null) {
        const p = party as Record<string, unknown>;
        return {
          ...p,
          // Keep type and isLead, redact nome and documento
          tipo: p.tipo,
          isLead: p.isLead,
          nome: '[REDACTED]',
          documento: p.documento ? '[REDACTED]' : undefined,
        };
      }
      return party;
    });
  }

  return redactNestedObject(sanitized);
}

/**
 * Create a sanitized query for logging
 *
 * @param query - Original query that may contain sensitive data
 * @returns Sanitized query safe for logging
 */
export function redactQueryForLog(query: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...query };

  // Redact authorization-related fields
  if ('headers' in sanitized && typeof sanitized.headers === 'object') {
    const headers = sanitized.headers as Record<string, unknown>;
    sanitized.headers = {
      ...headers,
      'Authorization': '[REDACTED]',
    };
  }

  // Redact body if it contains API key
  if ('body' in sanitized && typeof sanitized.body === 'string') {
    sanitized.body = redactDataJudKey(sanitized.body as string);
  }

  return sanitized;
}

/**
 * Create a safe log message for DataJud operations
 *
 * @param operation - Operation name
 * @param details - Details to log (will be sanitized)
 * @returns Safe log message
 */
export function createSafeLogMessage(
  operation: string,
  details: Record<string, unknown>
): string {
  const sanitizedDetails = redactQueryForLog(
    redactProcessForLog(details)
  );

  return `[DataJud] ${operation}: ${JSON.stringify(sanitizedDetails)}`;
}

/**
 * Logger wrapper that automatically redacts DataJud API keys
 *
 * @example
 * const log = createDataJudLogger('search');
 * log('Executing search query', { court: 'tjsp', size: 10 });
 * // Output: [DataJud][search] Executing search query: {"court":"tjsp","size":10}
 */
export function createDataJudLogger(operation: string): {
  (message: string, details?: Record<string, unknown>): void;
  info: (message: string, details?: Record<string, unknown>) => void;
  warn: (message: string, details?: Record<string, unknown>) => void;
  error: (message: string, error?: Error | string, details?: Record<string, unknown>) => void;
} {
  const formatMessage = (msg: string, details?: Record<string, unknown>): string => {
    const prefix = `[DataJud][${operation}]`;
    if (details) {
      const sanitized = redactQueryForLog(redactProcessForLog(details));
      return `${prefix} ${msg}: ${JSON.stringify(sanitized)}`;
    }
    return `${prefix} ${msg}`;
  };

  const logFn = (message: string, details?: Record<string, unknown>): void => {
    console.log(formatMessage(message, details));
  };

  logFn.info = (message: string, details?: Record<string, unknown>): void => {
    console.info(formatMessage(message, details));
  };

  logFn.warn = (message: string, details?: Record<string, unknown>): void => {
    console.warn(formatMessage(message, details));
  };

  logFn.error = (message: string, error?: Error | string, details?: Record<string, unknown>): void => {
    let errorMsg = message;
    if (error) {
      const errorText = typeof error === 'string' ? error : error.message;
      errorMsg = `${message}: ${redactDataJudKey(errorText)}`;
    }
    console.error(formatMessage(errorMsg, details));
  };

  return logFn;
}

/**
 * Validate that a string doesn't contain an API key pattern
 *
 * @param text - Text to validate
 * @returns true if safe (no API key detected), false if API key pattern found
 */
export function containsApiKeyPattern(text: string): boolean {
  // Check for various API key patterns
  const patterns = [
    /APIKey\s+[a-zA-Z0-9\-_]+/i,
    /Bearer\s+[a-zA-Z0-9\-_]+/i,
    /Authorization:\s*Bearer\s+[a-zA-Z0-9\-_]+/i,
    /x-api-key\s*[:=]\s*[a-zA-Z0-9\-_]+/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Safe error formatter for DataJud errors
 *
 * @param error - Error to format
 * @returns Error message safe for logging (API key redacted)
 */
export function formatErrorForLog(error: Error | unknown): string {
  if (error instanceof Error) {
    return redactDataJudKey(error.message);
  }
  return redactDataJudKey(String(error));
}

/**
 * Privacy level descriptions for logging
 */
export const SIGILO_DESCRIPTIONS: Record<number, string> = {
  0: 'Public',
  1: 'Restricted - Judicial secrecy',
  2: 'Restricted - Investigative secrecy',
  3: 'Restricted - State secrecy',
};

/**
 * Get privacy warning message for sigilo processes
 *
 * @param nivelSigilo - Confidentiality level
 * @returns Warning message for logging/display
 */
export function getSigiloWarning(nivelSigilo: number): string {
  if (nivelSigilo === 0) {
    return '';
  }

  const description = SIGILO_DESCRIPTIONS[nivelSigilo] || 'Restricted';
  return `Process has confidentiality level ${nivelSigilo} (${description}) - data redacted`;
}
