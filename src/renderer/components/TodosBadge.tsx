import { CheckCircle } from 'lucide-react';
import type { ConversationTask } from '../../database/types.js';

interface TodosBadgeProps {
  task: ConversationTask;
}

function TodosBadge({ task }: TodosBadgeProps) {
  const completed = task.todos?.completed ?? 0;
  const total = task.todos?.total ?? 0;

  if (!total && !completed) {
    return null;
  }

  return (
    <span className="flex items-center gap-[4px] text-[10px] text-gray-500">
      <CheckCircle size={12} className="text-green-400" />
      <span>{completed} / {total}</span>
    </span>
  );
}

export default TodosBadge;
