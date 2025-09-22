import { render } from 'preact';
import { useMemo, useEffect, useState } from 'preact/hooks';
import TaskSection from './components/TaskSection.js';
import LoadingState from './components/LoadingState.js';
import ErrorState from './components/ErrorState.js';
import { useOverlayData } from './hooks/useOverlayData.js';
import { useBlacklist } from './hooks/useBlacklist.js';

function OverlayApp() {
  const state = useOverlayData();
  const [forceKey, setForceKey] = useState(0);
  const { addToBlacklist } = useBlacklist();

  console.log('🎨 Renderer: OverlayApp render, state:', {
    isLoading: state.isLoading,
    error: state.error,
    tasksCount: state.tasks.length,
    tasks: state.tasks.map(t => ({ id: t.composerId, title: t.title, status: t.status }))
  });

  const buckets = useMemo(() => ({
    active: state.tasks.filter(task => task.status === 'active'),
    completed: state.tasks.filter(task => task.status === 'completed'),
    pending: state.tasks.filter(task => task.status === 'pending'),
  }), [state.tasks]);

  // Force re-render when tasks change
  useEffect(() => {
    setForceKey(prev => prev + 1);
  }, [state.tasks]);

  useEffect(() => {
    // Auto-resize window to fit content
    const resizeToContent = () => {
      const container = document.querySelector('#agent-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        window.api?.resizeWindow?.(rect.width, rect.height);
      }
    };

    // Resize after content loads
    const timeoutId = setTimeout(resizeToContent, 100);
    
    return () => clearTimeout(timeoutId);
  }, [state.tasks, state.isLoading]);

  if (state.isLoading) {
    return <LoadingState />;
  }

  if (state.error) {
    return <ErrorState message={state.error} />;
  }

  if(!state.tasks.length) {
    return <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="text-gray-500">No conversations found</div>
    </div>;
  }

  return (
    <div key={forceKey} className="flex flex-col">
      <div className="flex flex-col gap-1 px-3 py-2">
        <TaskSection
          title="Active Conversations"
          tasks={buckets.active}
          defaultExpanded={true}
          onHideConversation={addToBlacklist}
        />
        <TaskSection
          title="Completed Conversations"
          tasks={buckets.completed}
          defaultExpanded={true}
          onHideConversation={addToBlacklist}
        />
        <TaskSection
          title="Pending Conversations"
          tasks={buckets.pending}
          defaultExpanded={true}
          onHideConversation={addToBlacklist}
        />
      </div>
    </div>
  );
}

const container = document.getElementById('agent-container');

if (!container) {
  console.error('Renderer: agent container not found');
} else {
  render(<OverlayApp />, container);
}

