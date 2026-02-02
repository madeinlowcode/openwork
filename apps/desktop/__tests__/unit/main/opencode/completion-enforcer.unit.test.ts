/**
 * Unit tests for CompletionEnforcer tool-use guard.
 *
 * Tests that conversational responses (no tools used) skip continuation,
 * while real task work (tools used) still gets continuation enforcement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompletionEnforcer, CompletionEnforcerCallbacks } from '@main/opencode/completion/completion-enforcer';

function createMockCallbacks(): CompletionEnforcerCallbacks {
  return {
    onStartContinuation: vi.fn().mockResolvedValue(undefined),
    onComplete: vi.fn(),
    onDebug: vi.fn(),
  };
}

describe('CompletionEnforcer', () => {
  let enforcer: CompletionEnforcer;
  let callbacks: CompletionEnforcerCallbacks;

  beforeEach(() => {
    callbacks = createMockCallbacks();
    enforcer = new CompletionEnforcer(callbacks);
  });

  describe('tool-use guard', () => {
    it('should return complete when no tools used and no complete_task called', () => {
      // Simulate: agent responds to "hey" with text only, then stops
      const action = enforcer.handleStepFinish('stop');

      expect(action).toBe('complete');
    });

    it('should emit skip_continuation debug event when skipping', () => {
      enforcer.handleStepFinish('stop');

      expect(callbacks.onDebug).toHaveBeenCalledWith(
        'skip_continuation',
        expect.stringContaining('No tools used'),
      );
    });

    it('should schedule continuation when tools were used but no complete_task', () => {
      // Simulate: agent used tools (real work) then stopped without complete_task
      enforcer.markToolsUsed();
      const action = enforcer.handleStepFinish('stop');

      expect(action).toBe('pending');
    });

    it('should return complete when complete_task was called regardless of tools', () => {
      // Simulate: agent called complete_task with success
      enforcer.handleCompleteTaskDetection({ status: 'success', summary: 'Done', original_request_summary: 'hey' });
      const action = enforcer.handleStepFinish('stop');

      expect(action).toBe('complete');
    });

    it('should reset toolsWereUsed on reset()', () => {
      enforcer.markToolsUsed();
      enforcer.reset();

      // After reset, should skip continuation (no tools used)
      const action = enforcer.handleStepFinish('stop');
      expect(action).toBe('complete');
    });

    it('should still return continue for non-stop reasons', () => {
      // tool_use reason means more steps expected
      const action = enforcer.handleStepFinish('tool_use');
      expect(action).toBe('continue');
    });

    it('should return complete for end_turn when no tools used', () => {
      const action = enforcer.handleStepFinish('end_turn');
      expect(action).toBe('complete');
    });
  });

  describe('continuation with tools used', () => {
    it('should fire continuation on process exit when tools used but no complete_task', async () => {
      enforcer.markToolsUsed();
      enforcer.handleStepFinish('stop'); // returns 'pending'

      await enforcer.handleProcessExit(0);

      expect(callbacks.onStartContinuation).toHaveBeenCalled();
    });

    it('should reset toolsWereUsed between continuation attempts', async () => {
      // First invocation: agent uses tools, stops without complete_task
      enforcer.markToolsUsed();
      enforcer.handleStepFinish('stop'); // pending

      await enforcer.handleProcessExit(0); // spawns continuation, resets flag

      // Second invocation: continuation response has NO tools and NO complete_task
      // Should complete immediately (not loop)
      const action = enforcer.handleStepFinish('stop');
      expect(action).toBe('complete');
    });

    it('should call onComplete on process exit when no tools used', async () => {
      // No tools, no complete_task — handleStepFinish returns 'complete'
      // But if process exits without step_finish triggering completion:
      await enforcer.handleProcessExit(0);

      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(callbacks.onStartContinuation).not.toHaveBeenCalled();
    });
  });

  describe('partial continuation', () => {
    it('should handle partial status with continuation', async () => {
      enforcer.markToolsUsed();
      enforcer.handleCompleteTaskDetection({
        status: 'partial',
        summary: 'Did some work',
        original_request_summary: 'Do all the work',
        remaining_work: 'Finish the rest',
      });

      const action = enforcer.handleStepFinish('stop');
      expect(action).toBe('pending');

      await enforcer.handleProcessExit(0);
      expect(callbacks.onStartContinuation).toHaveBeenCalled();
    });
  });

  describe('continuation timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start timeout when continuation is started', async () => {
      // Create enforcer with short timeout for testing
      const shortTimeoutEnforcer = new CompletionEnforcer(callbacks, 20, 1000);
      
      shortTimeoutEnforcer.markToolsUsed();
      shortTimeoutEnforcer.handleStepFinish('stop');

      await shortTimeoutEnforcer.handleProcessExit(0);

      // Verify timeout debug event was emitted
      expect(callbacks.onDebug).toHaveBeenCalledWith(
        'continuation_timeout_started',
        expect.stringContaining('Started continuation timeout'),
        expect.objectContaining({ timeoutMs: 1000 })
      );
    });

    it('should call onComplete when timeout expires', async () => {
      // Create enforcer with short timeout for testing
      const shortTimeoutEnforcer = new CompletionEnforcer(callbacks, 20, 100);
      
      shortTimeoutEnforcer.markToolsUsed();
      shortTimeoutEnforcer.handleStepFinish('stop');

      await shortTimeoutEnforcer.handleProcessExit(0);

      // onComplete should not be called immediately
      expect(callbacks.onComplete).not.toHaveBeenCalled();

      // Fast forward past the timeout
      vi.advanceTimersByTime(150);

      // Now onComplete should have been called
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(callbacks.onDebug).toHaveBeenCalledWith(
        'continuation_timeout',
        expect.stringContaining('Continuation timed out'),
        expect.any(Object)
      );
    });

    it('should clear timeout on reset', async () => {
      const shortTimeoutEnforcer = new CompletionEnforcer(callbacks, 20, 100);
      
      shortTimeoutEnforcer.markToolsUsed();
      shortTimeoutEnforcer.handleStepFinish('stop');

      await shortTimeoutEnforcer.handleProcessExit(0);

      // Reset should clear the timeout
      shortTimeoutEnforcer.reset();

      // Fast forward past the timeout
      vi.advanceTimersByTime(150);

      // onComplete should NOT have been called by timeout (was cleared)
      expect(callbacks.onComplete).not.toHaveBeenCalled();
    });

    it('should clear timeout when task completes normally', async () => {
      const shortTimeoutEnforcer = new CompletionEnforcer(callbacks, 20, 100);
      
      shortTimeoutEnforcer.markToolsUsed();
      shortTimeoutEnforcer.handleStepFinish('stop');

      await shortTimeoutEnforcer.handleProcessExit(0);

      // Simulate normal completion before timeout
      shortTimeoutEnforcer.handleCompleteTaskDetection({
        status: 'success',
        summary: 'Done',
        original_request_summary: 'Test'
      });
      
      // This should clear the timeout
      await shortTimeoutEnforcer.handleProcessExit(0);

      // onComplete should have been called once by normal completion
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);

      // Fast forward past the timeout
      vi.advanceTimersByTime(150);

      // onComplete should still only have been called once (timeout was cleared)
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    });

    it('should use default timeout of 30 seconds', () => {
      // Default timeout should be 30000ms
      const defaultEnforcer = new CompletionEnforcer(callbacks);
      
      defaultEnforcer.markToolsUsed();
      defaultEnforcer.handleStepFinish('stop');

      defaultEnforcer.handleProcessExit(0);

      expect(callbacks.onDebug).toHaveBeenCalledWith(
        'continuation_timeout_started',
        expect.stringContaining('Started continuation timeout'),
        expect.objectContaining({ timeoutMs: 30000 })
      );
    });

    it('should start timeout for partial continuation', async () => {
      const shortTimeoutEnforcer = new CompletionEnforcer(callbacks, 20, 100);
      
      shortTimeoutEnforcer.markToolsUsed();
      shortTimeoutEnforcer.handleCompleteTaskDetection({
        status: 'partial',
        summary: 'Did some work',
        original_request_summary: 'Do all the work',
        remaining_work: 'Finish the rest',
      });
      shortTimeoutEnforcer.handleStepFinish('stop');

      await shortTimeoutEnforcer.handleProcessExit(0);

      // Verify timeout was started
      expect(callbacks.onDebug).toHaveBeenCalledWith(
        'continuation_timeout_started',
        expect.any(String),
        expect.objectContaining({ timeoutMs: 100 })
      );

      // Fast forward past the timeout
      vi.advanceTimersByTime(150);

      // onComplete should have been called by timeout
      expect(callbacks.onComplete).toHaveBeenCalled();
    });
  });
});
