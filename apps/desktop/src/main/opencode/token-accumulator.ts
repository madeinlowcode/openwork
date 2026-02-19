/**
 * @class TokenAccumulator
 * @description In-memory accumulator for token usage during a single task execution.
 * Tracks tokens per step across primary, retry, fallback, continuation, and summarization sources.
 *
 * @context OpenCode integration — collects token data as steps complete
 *
 * @dependencies
 * - None (pure TypeScript, no external deps)
 *
 * @usedBy
 * - main/opencode/adapter.ts (accumulates tokens during task execution)
 * - main/store/repositories/tokenUsage.ts (persists final totals)
 *
 * AIDEV-WARNING: stepCount is auto-incremented per addStep call within a source.
 * AIDEV-WARNING: finalizeCurrentSource() should be called before switching sources (retry/fallback).
 * AIDEV-NOTE: All token fields default to 0 if not provided.
 */

export interface TokenEntry {
  modelId: string;
  provider: string;
  source: 'primary' | 'retry' | 'fallback' | 'continuation' | 'summarization';
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd?: number;
  stepCount: number;
  stepNumber?: number;
}

export class TokenAccumulator {
  private entries: TokenEntry[] = [];
  private currentStepCount = 0;

  /**
   * Add a step's token usage to the accumulator.
   *
   * AIDEV-NOTE: stepCount auto-increments per call. Pass stepNumber to override.
   */
  addStep(params: {
    modelId: string;
    provider: string;
    source: TokenEntry['source'];
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    costUsd?: number;
    stepNumber?: number;
  }): void {
    this.currentStepCount++;

    this.entries.push({
      modelId: params.modelId,
      provider: params.provider,
      source: params.source,
      inputTokens: params.inputTokens ?? 0,
      outputTokens: params.outputTokens ?? 0,
      reasoningTokens: params.reasoningTokens ?? 0,
      cacheReadTokens: params.cacheReadTokens ?? 0,
      cacheWriteTokens: params.cacheWriteTokens ?? 0,
      costUsd: params.costUsd,
      stepCount: this.currentStepCount,
      stepNumber: params.stepNumber,
    });
  }

  /**
   * Snapshot entries before killing PTY for retry/fallback.
   * Resets stepCount for the next source phase.
   *
   * AIDEV-WARNING: Call this before switching from primary to retry/fallback.
   */
  finalizeCurrentSource(): TokenEntry[] {
    const snapshot = [...this.entries];
    this.currentStepCount = 0;
    return snapshot;
  }

  getEntries(): TokenEntry[] {
    return [...this.entries];
  }

  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
  }

  getTotalTokens(): { input: number; output: number; reasoning: number } {
    return this.entries.reduce(
      (acc, e) => ({
        input: acc.input + e.inputTokens,
        output: acc.output + e.outputTokens,
        reasoning: acc.reasoning + e.reasoningTokens,
      }),
      { input: 0, output: 0, reasoning: 0 }
    );
  }

  reset(): void {
    this.entries = [];
    this.currentStepCount = 0;
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }
}
