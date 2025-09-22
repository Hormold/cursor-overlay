import { useEffect, useRef, useState } from 'preact/hooks';
import type { ConversationSummary, ConversationTask, OverlayState } from '../../database/types.js';
import { useBlacklist } from './useBlacklist.js';


interface WindowAPI {
  log: (level: string, message: string) => Promise<void>;
  setIgnoreMouseEvents: (ignore: boolean) => Promise<void>;
  resizeWindow: (width: number, height: number) => Promise<void>;
  getRecentChats: (limit: number) => Promise<{ data?: ConversationSummary[]; error?: string }>;
  onDatabaseChanged: (callback: () => void) => (() => void) | void;
}

declare global {
  interface Window {
    api: WindowAPI;
  }
}

const INITIAL_STATE: OverlayState = {
  tasks: [],
  totalCompleted: 0,
  totalActive: 0,
  totalFiles: 0,
  isLoading: true,
  error: null,
};

function mapSummaryToTask(summary: ConversationSummary): ConversationTask {
  const todos = summary.todos ?? { completed: 0, total: 0, firstInProgress: 'unknown' };

  const status: ConversationTask['status'] =
    (summary.lastActivityTimeMsAgo !== undefined && summary.lastActivityTimeMsAgo < 60 * 1000 || summary.hasBlockingPendingActions)
      ? 'active'
      : todos.completed < todos.total
        ? 'pending'
        : 'completed';

  const task = {
    composerId: summary.composerId,
    title: summary.title || summary.firstMessage?.substring(0, 50) || 'Untitled conversation',
    description: summary.firstMessage || 'No description available',
    status,
    messageCount: summary.messageCount,
    hasCodeBlocks: summary.hasCodeBlocks,
    codeBlockCount: summary.codeBlockCount,
    relevantFiles: summary.relevantFiles || [],
    linesAdded: summary.linesAdded ?? 0,
    linesRemoved: summary.linesRemoved ?? 0,
    todos,
    projectName: summary.projectName,
    lastActivityTime: summary.lastActivityTime ?? 'moments',
    hasBlockingPendingActions: summary.hasBlockingPendingActions,
    modelName: summary.model,
  };

  return task;
}

function computeOverlayState(tasks: ConversationTask[]): OverlayState {
  const totalCompleted = tasks.filter(task => task.status === 'completed').length;
  const totalActive = tasks.filter(task => task.status === 'active').length;
  const totalFiles = tasks.reduce((sum, task) => sum + task.linesAdded, 0);

  return {
    tasks,
    totalCompleted,
    totalActive,
    totalFiles,
    isLoading: false,
    error: null,
  };
}

export function useOverlayData(refreshIntervalMs: number = 5_000): OverlayState {
  const [state, setState] = useState<OverlayState>(INITIAL_STATE);
  const isInitialLoad = useRef(true);
  const { isBlacklisted } = useBlacklist();

  useEffect(() => {
    let isMounted = true;

    // Listen for database changes from main process
    const handleDatabaseChanged = () => {
      load();
    };

    // Set up event listener for database changes
    const cleanupDatabaseListener = window.api.onDatabaseChanged(handleDatabaseChanged);

    async function load() {
      try {
        if (!isMounted) return;

        setState(prev => (
          isInitialLoad.current
            ? { ...prev, isLoading: true, error: null }
            : prev.error
              ? { ...prev, error: null }
              : prev
        ));

        const response = await window.api.getRecentChats(20);
        if (!isMounted) return;

        if (response.error) {
          window.api.log('error', `❌ Error loading conversations: ${response.error}`);
          setState(prev => ({ ...prev, isLoading: false, error: response.error || 'Failed to load conversations' }));
          return;
        }

        let summaries = response.data ?? [];
        summaries = summaries
          .filter(summary => summary.title)
          .filter(summary => summary.lastActivityTimeMsAgo < 24 * 60 * 60 * 1000)
          .filter(summary => !isBlacklisted(summary.composerId));
        const tasks = summaries.map(mapSummaryToTask);
        const newState = computeOverlayState(tasks);
        window.api.log('info', `🔄 Setting new state with ${newState.tasks.length} tasks`);
        setState(() => newState);
        isInitialLoad.current = false;
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        window.api.log('error', `❌ Error in load function: ${message}`);
        setState(prev => ({ ...prev, isLoading: false, error: message }));
        isInitialLoad.current = false;
      }
    }

    load();
    const intervalId = window.setInterval(load, refreshIntervalMs);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      if (cleanupDatabaseListener && typeof cleanupDatabaseListener === 'function') {
        cleanupDatabaseListener();
      }
    };
  }, [refreshIntervalMs]);

  return state;
}
