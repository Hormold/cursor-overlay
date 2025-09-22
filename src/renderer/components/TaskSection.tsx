import { ChevronDown, X } from 'lucide-react';
import { useState } from 'preact/hooks';
import type { ConversationTask } from '../../database/types.js';
import TaskCard from './TaskCard.js';

interface TaskSectionProps {
  title: string;
  tasks: ConversationTask[];
  defaultExpanded?: boolean;
  onHideConversation?: (id: string) => void;
}

function TaskSection({ title, tasks, defaultExpanded = false, onHideConversation }: TaskSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!tasks.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[1px]">
      <div
        onClick={(e) => {
          console.log('📁 Header clicked, current state:', isExpanded, '→ new state:', !isExpanded);
          setIsExpanded(!isExpanded);
        }}
        className="flex cursor-pointer items-center gap-1 px-3 py-1 mt-2 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-400"
        style={{ fontWeight: 400, lineHeight: '150%', letterSpacing: '0.12px', whiteSpace: 'nowrap' }}
      >
        <span style={{ paddingLeft: '4px' }}>{title} ({tasks.length})</span>
        <div className="flex items-center justify-center transition-all duration-200 cursor-pointer">
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={8} />
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="flex flex-col gap-[1px]">
          {tasks.map(task => (
            <TaskCard key={task.composerId} task={task} onHide={onHideConversation} />
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskSection;
