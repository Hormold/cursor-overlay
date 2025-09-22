import { X } from 'lucide-react';
import type { ConversationTask } from '../../database/types.js';
import StatusIcon from './StatusIcon.js';
import TodosBadge from './TodosBadge.js';

interface TaskCardProps {
  task: ConversationTask;
  onHide?: (id: string) => void;
}

function TaskCard({ task, onHide }: TaskCardProps) {
  const completed = task.todos?.completed ?? 0;
  const total = task.todos?.total ?? 0;
  const showTodos = completed > 0 || total > 0;

  return (
    <div
      className="group relative cursor-pointer rounded-[6px] px-[8px] py-[4px] text-sm transition-colors hover:bg-white/[0.02] pointer-events-auto"
      style={{ border: '1px solid transparent', color: 'rgb(123, 136, 161)' }}
      title={task.description}
    >
      {onHide && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onHide(task.composerId);
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-red-400 text-gray-500"
          style={{ width: '12px', height: '12px', padding: '1px' }}
          title="Hide this conversation"
        >
          <X size={8} />
        </button>
      )}
      <div className="flex min-w-0 items-center gap-1">
        <div className="flex items-center justify-center pr-[8px]">
          <StatusIcon status={task.status} hasBlockingPendingActions={task.hasBlockingPendingActions} />
        </div>
        <div
          className="text-gray-300 min-w-0 flex-1 truncate text-[12px] pr-2"
          style={{ lineHeight: '140%', letterSpacing: 0 }}
        >
          {task.title.length > 35 ? `${task.title.substring(0, 35)}...` : task.title}
        </div>
        <div className="flex h-[16px] flex-shrink-0 items-center gap-[6px] text-[10px]" style={{ opacity: 1, marginLeft: 5 }}>
          {task.linesAdded > 0 && <span className="text-[#A3BE8C]">+{task.linesAdded}</span>}
          {task.linesRemoved > 0 && <span className="text-[#BF616A]">-{task.linesRemoved}</span>}
        </div>
      </div>
      <div
        className="flex items-center gap-[4px] whitespace-nowrap pl-[22px] text-[11px] text-gray-500"
        style={{ lineHeight: '150%', letterSpacing: '0.07px' }}
      >
        {showTodos && (
          <>
            <TodosBadge task={task} />
            <span>•</span>
          </>
        )}
        <span className="truncate">{task.lastActivityTime} ago</span>
        <span>•</span>
        <span className="truncate">{task.projectName}</span>
      </div>
    </div>
  );
}

export default TaskCard;
