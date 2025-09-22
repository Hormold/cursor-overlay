import { render } from 'preact';
import { useMemo, useEffect } from 'preact/hooks';
import TaskSection from './components/TaskSection.js';
import LoadingState from './components/LoadingState.js';
import ErrorState from './components/ErrorState.js';
import { useOverlayData } from './hooks/useOverlayData.js';
import { useBlacklist } from './hooks/useBlacklist.js';

function OverlayApp() {
  const state = useOverlayData();
  const { addToBlacklist, isBlacklisted } = useBlacklist();

  const handleHideConversation = (id: string) => {
    const task = state.tasks.find(t => t.composerId === id);
    if (!task) return;
    
    if (confirm(`Add "${task.title}" to blacklist?\n\nThis conversation will be permanently hidden.`)) {
      addToBlacklist(id);
    }
  };
  // Filter out blacklisted tasks
  const filteredTasks = useMemo(() => 
    state.tasks.filter(task => !isBlacklisted(task.composerId)),
  [state.tasks, isBlacklisted],
  );

  const buckets = useMemo(() => ({
    active: filteredTasks.filter(task => task.status === 'active'),
    completed: filteredTasks.filter(task => task.status === 'completed'),
    pending: filteredTasks.filter(task => task.status === 'pending'),
  }), [filteredTasks]);

  useEffect(() => {
    // Auto-resize window to fit content
    const resizeToContent = () => {
      const container = document.querySelector('#agent-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        window.api?.resizeWindow?.(rect.width, rect.height);
        console.log('🔄 Resizing window to:', rect.width, rect.height);
      }
    };

    // Resize after content loads
    const timeoutId = setTimeout(resizeToContent, 100);
    
    return () => clearTimeout(timeoutId);
  }, [filteredTasks, state.isLoading]);

  if (state.isLoading) {
    return <LoadingState />;
  }

  if (state.error) {
    return <ErrorState message={state.error} />;
  }

  if(!filteredTasks.length) {
    return <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="text-gray-500">No conversations found</div>
    </div>;
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 px-3 py-2">
        <TaskSection
          title="Active Conversations"
          tasks={buckets.active}
          defaultExpanded={true}
          onHideConversation={handleHideConversation}
        />
        <TaskSection
          title="Completed Conversations"
          tasks={buckets.completed}
          defaultExpanded={true}
          onHideConversation={handleHideConversation}
        />
        <TaskSection
          title="Pending Conversations"
          tasks={buckets.pending}
          defaultExpanded={true}
          onHideConversation={handleHideConversation}
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

