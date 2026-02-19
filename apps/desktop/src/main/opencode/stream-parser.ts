import { EventEmitter } from 'events';
import type { OpenCodeMessage } from '@accomplish/shared';

export interface StreamParserEvents {
  message: [OpenCodeMessage];
  error: [Error];
}

// Maximum buffer size to prevent memory exhaustion (10MB)
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * @class StreamParser
 * @description Parses NDJSON stream from OpenCode CLI PTY output.
 *
 * @context Windows PTY issues that this parser handles:
 * 1. PTY inserts \r\n for line wrapping at column boundaries (corrupts JSON)
 * 2. JSON string values contain literal \n (not NDJSON delimiters)
 * 3. Process may exit before final \n delimiter arrives
 *
 * @dependencies
 * - @accomplish/shared (OpenCodeMessage type)
 *
 * @usedBy
 * - main/opencode/adapter.ts (feeds PTY stdout data)
 *
 * AIDEV-WARNING: This parser is critical for task completion detection.
 * AIDEV-WARNING: Previous approaches that FAILED:
 *   1. Brace-counting - desync on nested escaped JSON
 *   2. Try JSON.parse on every } - 16KB buffer concatenation (with cols=200)
 *   3. Simple split('\n') - cuts \n inside JSON strings
 *   4. String-aware inString tracking - desync on large JSONs, loses complete_task
 * AIDEV-NOTE: Current approach (v5): try JSON.parse at each \n. No state tracking.
 *   If parse fails, the \n was inside a string - keep accumulating.
 *   On flush, extract JSONs by trying } positions left-to-right.
 *   Simple, stateless, impossible to desync.
 */
export class StreamParser extends EventEmitter<StreamParserEvents> {
  private buffer: string = '';

  /**
   * Feed raw data from stdout.
   *
   * Strategy: strip \r, accumulate chars. At each \n, try JSON.parse on
   * the buffer. Success = NDJSON delimiter. Failure = \n inside a string,
   * keep it in the buffer and continue.
   *
   * AIDEV-NOTE: JSON.parse fails fast on invalid input, so trying at each
   * \n is efficient. With cols=30000, most messages have 0-1 internal \n.
   */
  feed(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      // Skip \r entirely - PTY wrapping artifact, never valid in JSON structure
      if (ch === '\r') {
        continue;
      }

      if (ch === '\n') {
        // Try to parse buffer as a complete JSON object
        const trimmed = this.buffer.trim();
        if (trimmed.startsWith('{')) {
          const message = this.tryParseJson(trimmed);
          if (message) {
            // Success - this \n was a real NDJSON delimiter
            console.log('[StreamParser] Parsed message type:', message.type);
            this.emitMessage(message);
            this.buffer = '';
            continue;
          }
        }
        // Parse failed or not JSON-like - this \n is inside a string value
        // or between non-JSON terminal output. Keep it in the buffer.
        if (trimmed) {
          this.buffer += '\n';
        }
        continue;
      }

      this.buffer += ch;
    }

    // Safety check: prevent memory exhaustion
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.emit('error', new Error('Stream buffer size exceeded maximum limit'));
      this.buffer = '';
    }
  }

  /**
   * Check if a line is terminal UI decoration (not JSON)
   */
  private isTerminalDecoration(line: string): boolean {
    const terminalChars = ['│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '─', '◆', '●', '○', '◇'];
    if (terminalChars.some(char => line.startsWith(char))) {
      return true;
    }
    if (/^[\x00-\x1F\x7F]/.test(line) || /^\x1b\[/.test(line)) {
      return true;
    }
    return false;
  }

  /**
   * Try to parse a JSON string, returns the message or null if invalid
   */
  private tryParseJson(jsonStr: string): OpenCodeMessage | null {
    try {
      return JSON.parse(jsonStr) as OpenCodeMessage;
    } catch {
      return null;
    }
  }

  /**
   * Emit a parsed message with enhanced logging
   */
  private emitMessage(message: OpenCodeMessage): void {
    if (message.type === 'tool_call' || message.type === 'tool_result' || message.type === 'tool_use') {
      const part = message.part as Record<string, unknown>;
      console.log('[StreamParser] Tool message details:', {
        type: message.type,
        tool: part?.tool,
        hasInput: !!part?.input,
        hasOutput: !!part?.output,
      });

      const toolName = String(part?.tool || '').toLowerCase();
      const output = String(part?.output || '').toLowerCase();
      if (toolName.includes('dev-browser') ||
          toolName.includes('browser') ||
          toolName.includes('mcp') ||
          output.includes('dev-browser') ||
          output.includes('browser')) {
        console.log('[StreamParser] >>> DEV-BROWSER MESSAGE <<<');
        console.log('[StreamParser] Full message:', JSON.stringify(message, null, 2));
      }
    }

    this.emit('message', message);
  }

  /**
   * Flush remaining buffer content when process exits.
   *
   * Extracts JSON objects by trying JSON.parse at each closing brace }
   * from left to right. This handles the case where the buffer contains
   * multiple concatenated JSON objects without \n delimiters (common when
   * the process exits before sending the final \n).
   *
   * AIDEV-WARNING: Called once at process exit. Performance is not critical.
   */
  flush(): void {
    let remaining = this.buffer.trim();
    this.buffer = '';

    if (!remaining) {
      return;
    }

    console.log('[StreamParser] Flush: extracting JSONs from buffer, len=' + remaining.length);

    let extractedCount = 0;

    while (remaining.length > 0) {
      // Find first { to start looking for JSON
      const startIdx = remaining.indexOf('{');
      if (startIdx === -1) break;

      // Skip any non-JSON content before the {
      if (startIdx > 0) {
        remaining = remaining.substring(startIdx);
      }

      // Try JSON.parse at each } position from left to right
      let found = false;
      let searchFrom = 0;

      while (searchFrom < remaining.length) {
        const endPos = remaining.indexOf('}', searchFrom);
        if (endPos === -1) break;

        const candidate = remaining.substring(0, endPos + 1);
        const message = this.tryParseJson(candidate);

        if (message) {
          console.log('[StreamParser] Flush: extracted message type:', message.type);
          this.emitMessage(message);
          remaining = remaining.substring(endPos + 1).trim();
          extractedCount++;
          found = true;
          break;
        }

        searchFrom = endPos + 1;
      }

      // No valid JSON found from current position - skip this { and try next
      if (!found) {
        // Try removing the first character and looking for next {
        remaining = remaining.substring(1);
      }
    }

    if (extractedCount > 0) {
      console.log('[StreamParser] Flush: extracted ' + extractedCount + ' messages total');
    } else if (remaining.trim()) {
      console.log('[StreamParser] Flush: no valid JSON found in residual buffer');
    }
  }

  /**
   * Reset the parser
   */
  reset(): void {
    this.buffer = '';
  }
}
