/**
 * @class OpenCodeFileReader
 * @description Reads token usage data from OpenCode CLI's flat-file JSON storage.
 * The CLI stores session data as individual JSON files under ~/.local/share/opencode/storage/.
 *
 * @context OpenCode integration — post-task token consumption reading
 *
 * @dependencies
 * - node:fs/promises (readdir, readFile, access)
 * - node:path (join)
 * - node:os (homedir)
 *
 * @relatedFiles
 * - main/opencode/token-accumulator.ts (in-memory accumulator that can be populated from this)
 * - main/opencode/adapter.ts (calls this after task completion)
 *
 * @usedBy
 * - main/opencode/adapter.ts (reads tokens after task finishes)
 *
 * ⚠️ AIDEV-WARNING: Tightly coupled to OpenCode CLI internal storage format.
 *    If the CLI changes its file structure, this will break silently (returns null).
 * ⚠️ AIDEV-WARNING: Only read AFTER task completion — files may be incomplete during execution.
 * 🔍 AIDEV-NOTE: Storage path is ~/.local/share/opencode/storage/ on ALL platforms (including Windows).
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { constants } from 'node:fs';

// AIDEV-NOTE: Matches the step-finish part's tokens field from CLI storage
export interface StepTokenData {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  modelId: string;
  provider: string;
}

export interface SessionTokenData {
  sessionId: string;
  steps: StepTokenData[];
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
}

export class OpenCodeFileReader {
  /**
   * @function getStoragePath
   * @description Returns the base storage path for OpenCode CLI data.
   * @returns {string} Absolute path to ~/.local/share/opencode/storage/
   *
   * ⚠️ AIDEV-WARNING: Uses ~/.local/share/opencode/storage/ on ALL OS including Windows.
   *    This matches the Go CLI's behavior which uses this path universally.
   */
  private getStoragePath(): string {
    return join(homedir(), '.local', 'share', 'opencode', 'storage');
  }

  /**
   * @function isAvailable
   * @description Checks if the OpenCode storage directory exists and is readable.
   * @returns {Promise<boolean>} true if storage is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      await access(this.getStoragePath(), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @function readSessionTokens
   * @description Reads all token usage data for a given session ID.
   *
   * Algorithm:
   * 1. List message/{sessionID}/ to get messageIDs + model info
   * 2. For each messageID, list part/{messageID}/*.json
   * 3. Filter parts by type === 'step-finish'
   * 4. Extract tokens and cost from each step-finish
   * 5. Associate model from the corresponding message
   *
   * @param {string} sessionId - The OpenCode session ID (e.g. "ses_...")
   * @returns {Promise<SessionTokenData | null>} Token data or null if unavailable
   *
   * ⚠️ AIDEV-WARNING: Only call after task completion. During execution, files may be partial.
   */
  async readSessionTokens(sessionId: string): Promise<SessionTokenData | null> {
    const storagePath = this.getStoragePath();
    const messagesDir = join(storagePath, 'message', sessionId);

    let messageFiles: string[];
    try {
      messageFiles = await readdir(messagesDir);
    } catch {
      // Storage or session dir doesn't exist
      return null;
    }

    // AIDEV-NOTE: Map messageID → { modelId, provider } for association with parts
    const modelMap = new Map<string, { modelId: string; provider: string }>();

    for (const file of messageFiles) {
      if (!file.endsWith('.json')) continue;
      const messageId = file.replace('.json', '');
      const model = await this.readMessageModel(sessionId, messageId);
      if (model) {
        modelMap.set(messageId, model);
      }
    }

    const steps: StepTokenData[] = [];

    // AIDEV-NOTE: Iterate each message's parts looking for step-finish entries
    for (const file of messageFiles) {
      if (!file.endsWith('.json')) continue;
      const messageId = file.replace('.json', '');
      const partsDir = join(storagePath, 'part', messageId);

      let partFiles: string[];
      try {
        partFiles = await readdir(partsDir);
      } catch {
        // No parts for this message — skip
        continue;
      }

      const model = modelMap.get(messageId) ?? { modelId: 'unknown', provider: 'unknown' };

      for (const partFile of partFiles) {
        if (!partFile.endsWith('.json')) continue;

        try {
          const raw = await readFile(join(partsDir, partFile), 'utf-8');
          const part = JSON.parse(raw);

          if (part.type !== 'step-finish') continue;
          if (!part.tokens) continue;

          steps.push({
            inputTokens: part.tokens.input ?? 0,
            outputTokens: part.tokens.output ?? 0,
            reasoningTokens: part.tokens.reasoning ?? 0,
            cacheReadTokens: part.tokens.cache?.read ?? 0,
            cacheWriteTokens: part.tokens.cache?.write ?? 0,
            costUsd: part.cost ?? 0,
            modelId: model.modelId,
            provider: model.provider,
          });
        } catch {
          // Malformed JSON — skip this part file
          continue;
        }
      }
    }

    return {
      sessionId,
      steps,
      totalCost: steps.reduce((sum, s) => sum + s.costUsd, 0),
      totalInputTokens: steps.reduce((sum, s) => sum + s.inputTokens, 0),
      totalOutputTokens: steps.reduce((sum, s) => sum + s.outputTokens, 0),
      totalReasoningTokens: steps.reduce((sum, s) => sum + s.reasoningTokens, 0),
    };
  }

  /**
   * @function readMessageModel
   * @description Reads model info (provider + modelID) from a message JSON file.
   *
   * @param {string} sessionId - Session ID
   * @param {string} messageId - Message ID
   * @returns {Promise<{modelId: string, provider: string} | null>} Model info or null
   */
  private async readMessageModel(
    sessionId: string,
    messageId: string
  ): Promise<{ modelId: string; provider: string } | null> {
    try {
      const filePath = join(this.getStoragePath(), 'message', sessionId, `${messageId}.json`);
      const raw = await readFile(filePath, 'utf-8');
      const msg = JSON.parse(raw);

      if (msg.model?.providerID && msg.model?.modelID) {
        return { modelId: msg.model.modelID, provider: msg.model.providerID };
      }
      return null;
    } catch {
      return null;
    }
  }
}
