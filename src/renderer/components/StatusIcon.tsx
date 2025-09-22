import {
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  RefreshCcw
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConversationTask } from '../../database/types.js';

const STATUS_ICON: Record<ConversationTask['status'], LucideIcon> = {
  active: RefreshCcw,
  completed: CheckCircle,
  pending: Clock
};

interface StatusIconProps {
  status: ConversationTask['status'];
  hasBlockingPendingActions: boolean;
}

function StatusIcon({ status, hasBlockingPendingActions }: StatusIconProps) {
  const Icon = STATUS_ICON[status] ?? HelpCircle;
  const className =
    status === 'active'
      ? 'h-3 w-3 text-blue-400 animate-spin'
      : status === 'completed'
        ? 'h-3 w-3 text-green-400'
        : 'h-3 w-3 text-gray-500';

  const colorForIcon = status === 'active' ? 'text-blue-400' : status === 'completed' ? 'text-green-400' : 'text-gray-500';
  
  return <div className="flex items-center" style={{ gap: '4px' }}>
    {hasBlockingPendingActions ? <AlertTriangle size={12} strokeWidth={2.5} className="h-3 w-3 text-yellow-500" fill='#FFD43B' /> : null}
    <Icon size={12} strokeWidth={2.5} className={className} style={{ color: colorForIcon }} />
  </div>;
}

export default StatusIcon;
