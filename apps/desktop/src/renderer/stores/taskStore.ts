import { create } from 'zustand';
import type {
  Task,
  TaskConfig,
  TaskStatus,
  TaskUpdateEvent,
  PermissionRequest,
  PermissionResponse,
  TaskMessage,
  TodoItem,
} from '@accomplish/shared';
import { getJurisiar } from '../lib/jurisiar';

// Batch update event type for performance optimization
interface TaskUpdateBatchEvent {
  taskId: string;
  messages: TaskMessage[];
}

// Setup progress event type
interface SetupProgressEvent {
  taskId: string;
  stage: string;
  message?: string;
  isFirstTask?: boolean;
  modelName?: string;
}

// Startup stage info for the progress indicator
export interface StartupStageInfo {
  stage: string;
  message: string;
  modelName?: string;
  isFirstTask: boolean;
  startTime: number;
}

interface TaskState {
  // Current task
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;

  // Task history
  tasks: Task[];

  // Permission handling
  permissionRequest: PermissionRequest | null;

  // Setup progress (e.g., browser download)
  setupProgress: string | null;
  setupProgressTaskId: string | null;
  setupDownloadStep: number; // 1=Chromium, 2=FFMPEG, 3=Headless Shell

  // Startup stage progress (for task initialization indicator)
  startupStage: StartupStageInfo | null;
  startupStageTaskId: string | null;

  // Todo tracking
  todos: TodoItem[];
  todosTaskId: string | null;

  // Auth error (e.g., OAuth token expired)
  authError: { providerId: string; message: string } | null;

  // Task launcher
  isLauncherOpen: boolean;
  openLauncher: () => void;
  closeLauncher: () => void;

  // Multi-select state
  // AIDEV-NOTE: Set para performance O(1) em verificações de seleção
  selectedTaskIds: Set<string>;
  isSelectionMode: boolean;

  // Actions
  startTask: (config: TaskConfig) => Promise<Task | null>;
  setSetupProgress: (taskId: string | null, message: string | null) => void;
  setStartupStage: (taskId: string | null, stage: string | null, message?: string, modelName?: string, isFirstTask?: boolean) => void;
  clearStartupStage: (taskId: string) => void;
  sendFollowUp: (message: string) => Promise<void>;
  cancelTask: () => Promise<void>;
  interruptTask: () => Promise<void>;
  setPermissionRequest: (request: PermissionRequest | null) => void;
  respondToPermission: (response: PermissionResponse) => Promise<void>;
  addTaskUpdate: (event: TaskUpdateEvent) => void;
  addTaskUpdateBatch: (event: TaskUpdateBatchEvent) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  setTaskSummary: (taskId: string, summary: string) => void;
  loadTasks: () => Promise<void>;
  loadTaskById: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  reset: () => void;
  setTodos: (taskId: string, todos: TodoItem[]) => void;
  clearTodos: () => void;
  setAuthError: (error: { providerId: string; message: string }) => void;
  clearAuthError: () => void;

  // Multi-select actions
  // AIDEV-WARNING: toggleTaskSelection auto-entra no modo seleção se não estiver ativo
  toggleTaskSelection: (taskId: string) => void;
  selectAllTasks: () => void;
  clearSelection: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  deleteSelectedTasks: () => Promise<number>;
}

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  currentTask: null,
  isLoading: false,
  error: null,
  tasks: [],
  permissionRequest: null,
  setupProgress: null,
  setupProgressTaskId: null,
  setupDownloadStep: 1,
  startupStage: null,
  startupStageTaskId: null,
  todos: [],
  todosTaskId: null,
  authError: null,
  isLauncherOpen: false,
  // Multi-select state
  selectedTaskIds: new Set<string>(),
  isSelectionMode: false,

  setSetupProgress: (taskId: string | null, message: string | null) => {
    // Detect which package is being downloaded from the message
    let step = useTaskStore.getState().setupDownloadStep;
    if (message) {
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('downloading chromium headless')) {
        step = 3;
      } else if (lowerMsg.includes('downloading ffmpeg')) {
        step = 2;
      } else if (lowerMsg.includes('downloading chromium')) {
        step = 1;
      }
    }
    set({ setupProgress: message, setupProgressTaskId: taskId, setupDownloadStep: step });
  },

  setStartupStage: (taskId: string | null, stage: string | null, message?: string, modelName?: string, isFirstTask?: boolean) => {
    if (!taskId || !stage) {
      set({ startupStage: null, startupStageTaskId: null });
      return;
    }

    const currentState = get();
    // Preserve startTime if this is the same task, otherwise start fresh
    const startTime = currentState.startupStageTaskId === taskId && currentState.startupStage
      ? currentState.startupStage.startTime
      : Date.now();

    set({
      startupStage: {
        stage,
        message: message || stage,
        modelName,
        isFirstTask: isFirstTask ?? false,
        startTime,
      },
      startupStageTaskId: taskId,
    });
  },

  clearStartupStage: (taskId: string) => {
    const currentState = get();
    if (currentState.startupStageTaskId === taskId) {
      set({ startupStage: null, startupStageTaskId: null });
    }
  },

  startTask: async (config: TaskConfig) => {
    const jurisiar = getJurisiar();
    set({ isLoading: true, error: null });
    try {
      void jurisiar.logEvent({
        level: 'info',
        message: 'UI start task',
        context: { prompt: config.prompt, taskId: config.taskId },
      });
      const task = await jurisiar.startTask(config);
      // Task might be 'running' or 'queued' depending on if another task is running
      // Also add to tasks list so sidebar updates immediately
      const currentTasks = get().tasks;
      set({
        currentTask: task,
        tasks: [task, ...currentTasks.filter((t) => t.id !== task.id)],
        // Keep loading state if queued (waiting for queue)
        isLoading: task.status === 'queued',
      });
      void jurisiar.logEvent({
        level: 'info',
        message: task.status === 'queued' ? 'UI task queued' : 'UI task started',
        context: { taskId: task.id, status: task.status },
      });
      return task;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to start task',
        isLoading: false,
      });
      void jurisiar.logEvent({
        level: 'error',
        message: 'UI task start failed',
        context: { error: err instanceof Error ? err.message : String(err) },
      });
      return null;
    }
  },

  sendFollowUp: async (message: string) => {
    const jurisiar = getJurisiar();
    const { currentTask, startTask } = get();
    if (!currentTask) {
      set({ error: 'No active task to continue' });
      void jurisiar.logEvent({
        level: 'warn',
        message: 'UI follow-up failed: no active task',
      });
      return;
    }

    const sessionId = currentTask.result?.sessionId || currentTask.sessionId;

    // If no session but task was interrupted, start a fresh task with the new message
    if (!sessionId && currentTask.status === 'interrupted') {
      void jurisiar.logEvent({
        level: 'info',
        message: 'UI follow-up: starting fresh task (no session from interrupted task)',
        context: { taskId: currentTask.id },
      });
      await startTask({ prompt: message });
      return;
    }

    if (!sessionId) {
      set({ error: 'No session to continue - please start a new task' });
      void jurisiar.logEvent({
        level: 'warn',
        message: 'UI follow-up failed: missing session',
        context: { taskId: currentTask.id },
      });
      return;
    }

    const userMessage: TaskMessage = {
      id: createMessageId(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Optimistically add user message and set status to running
    const taskId = currentTask.id;
    set((state) => ({
      isLoading: true,
      error: null,
      currentTask: state.currentTask
        ? {
            ...state.currentTask,
            status: 'running',
            result: undefined,
            messages: [...state.currentTask.messages, userMessage],
          }
        : null,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'running' as TaskStatus } : t
      ),
    }));

    try {
      void jurisiar.logEvent({
        level: 'info',
        message: 'UI follow-up sent',
        context: { taskId: currentTask.id, message },
      });
      const task = await jurisiar.resumeSession(sessionId, message, currentTask.id);

      // Update status based on response (could be 'running' or 'queued')
      set((state) => ({
        currentTask: state.currentTask
          ? { ...state.currentTask, status: task.status }
          : null,
        isLoading: task.status === 'queued',
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: task.status } : t
        ),
      }));
    } catch (err) {
      set((state) => ({
        error: err instanceof Error ? err.message : 'Failed to send message',
        isLoading: false,
        currentTask: state.currentTask
          ? { ...state.currentTask, status: 'failed' }
          : null,
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'failed' as TaskStatus } : t
        ),
      }));
      void jurisiar.logEvent({
        level: 'error',
        message: 'UI follow-up failed',
        context: { taskId: currentTask.id, error: err instanceof Error ? err.message : String(err) },
      });
    }
  },

  cancelTask: async () => {
    const jurisiar = getJurisiar();
    const { currentTask } = get();
    if (currentTask) {
      void jurisiar.logEvent({
        level: 'info',
        message: 'UI cancel task',
        context: { taskId: currentTask.id },
      });
      await jurisiar.cancelTask(currentTask.id);
      set((state) => ({
        currentTask: state.currentTask
          ? { ...state.currentTask, status: 'cancelled' }
          : null,
        tasks: state.tasks.map((t) =>
          t.id === currentTask.id ? { ...t, status: 'cancelled' as TaskStatus } : t
        ),
      }));
    }
  },

  interruptTask: async () => {
    const jurisiar = getJurisiar();
    const { currentTask } = get();
    if (currentTask && currentTask.status === 'running') {
      void jurisiar.logEvent({
        level: 'info',
        message: 'UI interrupt task',
        context: { taskId: currentTask.id },
      });
      await jurisiar.interruptTask(currentTask.id);
      // Note: Don't change task status - task is still running, just interrupted
    }
  },

  setPermissionRequest: (request) => {
    set({ permissionRequest: request });
  },

  respondToPermission: async (response: PermissionResponse) => {
    const jurisiar = getJurisiar();
    void jurisiar.logEvent({
      level: 'info',
      message: 'UI permission response',
      context: { ...response },
    });
    await jurisiar.respondToPermission(response);
    set({ permissionRequest: null });
  },

  addTaskUpdate: (event: TaskUpdateEvent) => {
    const jurisiar = getJurisiar();
    void jurisiar.logEvent({
      level: 'debug',
      message: 'UI task update received',
      context: { ...event },
    });
    set((state) => {
      // Determine if this event is for the currently viewed task
      const isCurrentTask = state.currentTask?.id === event.taskId;

      // Start with current state
      let updatedCurrentTask = state.currentTask;
      let updatedTasks = state.tasks;
      let newStatus: TaskStatus | null = null;

      // Handle message events - only if viewing this task
      if (event.type === 'message' && event.message && isCurrentTask && state.currentTask) {
        updatedCurrentTask = {
          ...state.currentTask,
          messages: [...state.currentTask.messages, event.message],
        };
      }

      // Handle complete events
      if (event.type === 'complete' && event.result) {
        // Map result status to task status
        if (event.result.status === 'success') {
          newStatus = 'completed';
        } else if (event.result.status === 'interrupted') {
          newStatus = 'interrupted';
        } else {
          newStatus = 'failed';
        }

        // Update currentTask if viewing this task
        if (isCurrentTask && state.currentTask) {
          updatedCurrentTask = {
            ...state.currentTask,
            status: newStatus,
            result: event.result,
            // Don't set completedAt for interrupted tasks - they can continue
            completedAt: newStatus === 'interrupted' ? undefined : new Date().toISOString(),
            sessionId: event.result.sessionId || state.currentTask.sessionId,
          };
        }
      }

      // Handle error events
      if (event.type === 'error') {
        newStatus = 'failed';

        // Update currentTask if viewing this task
        if (isCurrentTask && state.currentTask) {
          updatedCurrentTask = {
            ...state.currentTask,
            status: newStatus,
            result: { status: 'error', error: event.error },
          };
        }
      }

      // Always update sidebar tasks list if status changed
      if (newStatus) {
        const finalStatus = newStatus;
        updatedTasks = state.tasks.map((t) =>
          t.id === event.taskId ? { ...t, status: finalStatus } : t
        );
      }

      // Determine if we should clear todos
      // Only clear todos if:
      // 1. They belong to this task
      // 2. Task is fully completed (not interrupted - user can still continue)
      let shouldClearTodos = false;
      if ((event.type === 'complete' || event.type === 'error') && state.todosTaskId === event.taskId) {
        const isInterrupted = event.type === 'complete' && event.result?.status === 'interrupted';
        shouldClearTodos = !isInterrupted;
      }

      return {
        currentTask: updatedCurrentTask,
        tasks: updatedTasks,
        isLoading: false,
        ...(shouldClearTodos ? { todos: [], todosTaskId: null } : {}),
      };
    });
  },

  // Batch update handler for performance - processes multiple messages in single state update
  addTaskUpdateBatch: (event: TaskUpdateBatchEvent) => {
    const jurisiar = getJurisiar();
    void jurisiar.logEvent({
      level: 'debug',
      message: 'UI task batch update received',
      context: { taskId: event.taskId, messageCount: event.messages.length },
    });
    set((state) => {
      if (!state.currentTask || state.currentTask.id !== event.taskId) {
        return state;
      }

      // Add all messages in a single state update
      const updatedTask = {
        ...state.currentTask,
        messages: [...state.currentTask.messages, ...event.messages],
      };

      return { currentTask: updatedTask, isLoading: false };
    });
  },

  // Update task status (e.g., queued -> running)
  updateTaskStatus: (taskId: string, status: TaskStatus) => {
    set((state) => {
      // Update in tasks list
      const updatedTasks = state.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status, updatedAt: new Date().toISOString() }
          : task
      );

      // Update currentTask if it matches
      const updatedCurrentTask =
        state.currentTask?.id === taskId
          ? { ...state.currentTask, status, updatedAt: new Date().toISOString() }
          : state.currentTask;

      return {
        tasks: updatedTasks,
        currentTask: updatedCurrentTask,
      };
    });
  },

  // Update task summary (AI-generated)
  setTaskSummary: (taskId: string, summary: string) => {
    set((state) => {
      // Update in tasks list
      const updatedTasks = state.tasks.map((task) =>
        task.id === taskId ? { ...task, summary } : task
      );

      // Update currentTask if it matches
      const updatedCurrentTask =
        state.currentTask?.id === taskId
          ? { ...state.currentTask, summary }
          : state.currentTask;

      return {
        tasks: updatedTasks,
        currentTask: updatedCurrentTask,
      };
    });
  },

  loadTasks: async () => {
    const jurisiar = getJurisiar();
    const tasks = await jurisiar.listTasks();
    set({ tasks });
  },

  loadTaskById: async (taskId: string) => {
    const jurisiar = getJurisiar();
    const task = await jurisiar.getTask(taskId);
    set({ currentTask: task, error: task ? null : 'Task not found' });
  },

  deleteTask: async (taskId: string) => {
    const jurisiar = getJurisiar();
    await jurisiar.deleteTask(taskId);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));
  },

  clearHistory: async () => {
    const jurisiar = getJurisiar();
    await jurisiar.clearTaskHistory();
    set({ tasks: [] });
  },

  reset: () => {
    set({
      currentTask: null,
      isLoading: false,
      error: null,
      permissionRequest: null,
      setupProgress: null,
      setupProgressTaskId: null,
      setupDownloadStep: 1,
      startupStage: null,
      startupStageTaskId: null,
      todos: [],
      todosTaskId: null,
      authError: null,
      isLauncherOpen: false,
      // Multi-select reset
      selectedTaskIds: new Set<string>(),
      isSelectionMode: false,
    });
  },

  setTodos: (taskId: string, todos: TodoItem[]) => {
    set({ todos, todosTaskId: taskId });
  },

  clearTodos: () => {
    set({ todos: [], todosTaskId: null });
  },

  setAuthError: (error: { providerId: string; message: string }) => {
    set({ authError: error });
  },

  clearAuthError: () => {
    set({ authError: null });
  },

  openLauncher: () => set({ isLauncherOpen: true }),
  closeLauncher: () => set({ isLauncherOpen: false }),

  // Multi-select actions
  // AIDEV-WARNING: toggleTaskSelection auto-entra no modo seleção se não estiver ativo
  toggleTaskSelection: (taskId: string) => {
    set((state) => {
      const newSelected = new Set(state.selectedTaskIds);
      if (newSelected.has(taskId)) {
        newSelected.delete(taskId);
      } else {
        newSelected.add(taskId);
      }
      return {
        selectedTaskIds: newSelected,
        // Auto-enter selection mode when selecting via Shift+Click
        isSelectionMode: newSelected.size > 0 ? true : state.isSelectionMode,
      };
    });
  },

  selectAllTasks: () => {
    set((state) => ({
      selectedTaskIds: new Set(state.tasks.map((t) => t.id)),
    }));
  },

  clearSelection: () => {
    set({ selectedTaskIds: new Set<string>() });
  },

  enterSelectionMode: () => {
    set({ isSelectionMode: true });
  },

  exitSelectionMode: () => {
    set({
      isSelectionMode: false,
      selectedTaskIds: new Set<string>(),
    });
  },

  /**
   * @action deleteSelectedTasks
   * @description Exclui todas as tarefas selecionadas via IPC
   *
   * @returns {Promise<number>} Número de tarefas excluídas
   *
   * ⚠️ AIDEV-WARNING: Sai do modo seleção automaticamente após exclusão
   * AIDEV-NOTE: Atualiza estado local após confirmação do backend
   */
  deleteSelectedTasks: async () => {
    const jurisiar = getJurisiar();
    const { selectedTaskIds, tasks } = get();
    const idsToDelete = Array.from(selectedTaskIds);

    if (idsToDelete.length === 0) return 0;

    const deletedCount = await jurisiar.deleteTasksMany(idsToDelete);

    set({
      tasks: tasks.filter((t) => !selectedTaskIds.has(t.id)),
      selectedTaskIds: new Set<string>(),
      isSelectionMode: false,
    });

    return deletedCount;
  },
}));

// Startup stages that should be tracked (before first tool runs)
const STARTUP_STAGES = ['starting', 'browser', 'environment', 'loading', 'connecting', 'waiting', 'retry-waiting', 'retry-attempting', 'retry-exhausted', 'fallback'];

// Global subscription to setup progress events (browser download, startup stages, etc.)
// This runs when the module is loaded to catch early progress events
if (typeof window !== 'undefined' && window.jurisiar) {
  window.jurisiar.onTaskProgress((progress: unknown) => {
    const event = progress as SetupProgressEvent;
    const state = useTaskStore.getState();

    // Handle startup stages
    if (STARTUP_STAGES.includes(event.stage)) {
      state.setStartupStage(event.taskId, event.stage, event.message, event.modelName, event.isFirstTask);
      return;
    }

    // Handle tool-use stage - clear startup stage since first tool has arrived
    if (event.stage === 'tool-use') {
      state.clearStartupStage(event.taskId);
      return;
    }

    // Handle browser download progress (setup stage)
    if (event.stage === 'setup' && event.message) {
      // Clear progress if installation completed
      if (event.message.toLowerCase().includes('installed successfully')) {
        state.setSetupProgress(null, null);
      } else {
        state.setSetupProgress(event.taskId, event.message);
      }
      return;
    }

    // Legacy fallback for other messages
    if (event.message) {
      if (event.message.toLowerCase().includes('installed successfully')) {
        state.setSetupProgress(null, null);
      } else if (event.message.toLowerCase().includes('download')) {
        state.setSetupProgress(event.taskId, event.message);
      }
    }
  });

  // Clear progress when task completes or errors
  window.jurisiar.onTaskUpdate((event: unknown) => {
    const updateEvent = event as TaskUpdateEvent;
    if (updateEvent.type === 'complete' || updateEvent.type === 'error') {
      const state = useTaskStore.getState();
      if (state.setupProgressTaskId === updateEvent.taskId) {
        state.setSetupProgress(null, null);
      }
      state.clearStartupStage(updateEvent.taskId);
      // Note: todos are cleared in addTaskUpdate() based on interrupt status
    }
  });

  // Subscribe to task summary updates
  window.jurisiar.onTaskSummary?.(( data: { taskId: string; summary: string }) => {
    useTaskStore.getState().setTaskSummary(data.taskId, data.summary);
  });

  // Subscribe to todo updates
  window.jurisiar.onTodoUpdate?.((data: { taskId: string; todos: TodoItem[] }) => {
    useTaskStore.getState().setTodos(data.taskId, data.todos);
  });

  // Subscribe to auth error events (e.g., OAuth token expired)
  window.jurisiar.onAuthError?.((data: { providerId: string; message: string }) => {
    useTaskStore.getState().setAuthError(data);
  });
}
