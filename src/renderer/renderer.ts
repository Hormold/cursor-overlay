// Export empty object to make this a module
export {};

import type { ConversationSummary, ConversationTask, OverlayState } from '../database/types.js';

interface WindowAPI {
  getRecentChats: (limit: number) => Promise<{ data?: ConversationSummary[]; error?: string }>;
  onChatsUpdate: (callback: (chats: ConversationSummary[]) => void) => void;
}

declare global {
  interface Window {
    api: WindowAPI;
  }
}

class AgentOverlay {
  private container: HTMLElement | null = null;
  private state: OverlayState = {
    tasks: [],
    totalCompleted: 0,
    totalActive: 0,
    totalFiles: 0,
    isLoading: true,
    error: null
  };

  constructor() {
    this.init();
  }

  private async init() {
    console.log('🎯 Renderer: Initializing AgentOverlay...');

    this.container = document.getElementById('agent-container');
    if (!this.container) {
      console.error('❌ Renderer: Agent container not found');
      return;
    }

    console.log('✅ Renderer: Container found');

    // Load real conversation data
    await this.loadConversationData();

    // Update conversation data every 30 seconds
    setInterval(() => this.loadConversationData(), 30000);
  }

  private async loadConversationData(): Promise<void> {
    try {
      this.state.isLoading = true;
      this.state.error = null;
      this.renderOverlay();

      console.log('📊 Loading conversation data...');
      const response = await window.api.getRecentChats(20);
      
      if (response.error) {
        this.state.error = response.error;
        this.state.isLoading = false;
        this.renderOverlay();
        return;
      }

      if (!response.data) {
        this.state.error = 'No conversation data received';
        this.state.isLoading = false;
        this.renderOverlay();
        return;
      }

      const tasks = response.data.map((summary): ConversationTask => {   
        
        return {
          composerId: summary.composerId,
          title: summary.title || summary.firstMessage?.substring(0, 50) || 'Untitled conversation',
          description: summary.firstMessage || 'No description available',
          status: summary.lastActivityTimeMsAgo < 60 * 1000 ? 'active' : 'completed',
          messageCount: summary.messageCount,
          hasCodeBlocks: summary.hasCodeBlocks,
          codeBlockCount: summary.codeBlockCount,
          relevantFiles: summary.relevantFiles || [],
          todos: summary.todos,
          isOngoing: false,
          lastActivityTime: summary.lastActivityTime,
          linesAdded: summary.linesAdded,
          linesRemoved: summary.linesRemoved,
        };
      });

      this.state.tasks = tasks;

      this.updateStatistics();
      this.state.isLoading = false;
      
      this.renderOverlay();
    } catch (error) {
      console.error('❌ Error loading conversation data:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.state.isLoading = false;
      this.renderOverlay();
    }
  }

  private updateStatistics(): void {
    this.state.totalCompleted = this.state.tasks.filter(t => t.status === 'completed').length;
    this.state.totalActive = this.state.tasks.filter(t => t.status === 'active').length;
    this.state.totalFiles = this.state.tasks.reduce((sum, t) => sum + t.linesAdded, 0);
  }

  private renderOverlay(): void {
    
    if (!this.container) return;
    
    if (this.state.isLoading) {
      this.container.innerHTML = `
        <div class="flex items-center justify-center h-full">
          <div class="text-gray-400 text-sm">Loading conversations...</div>
        </div>
      `;
      return;
    }

    if (this.state.error) {
      this.container.innerHTML = `
        <div class="flex items-center justify-center h-full">
          <div class="text-red-400 text-sm">Error: ${this.state.error}</div>
        </div>
      `;
      return;
    }
    
    const getStatusIcon = (status: ConversationTask['status']) => {
      switch (status) {
        case 'active': return `<i data-lucide="refresh-cw" class="h-3 w-3 text-blue-400 animate-spin"></i>`;
        case 'completed': return `<i data-lucide="check-circle" class="h-3 w-3 text-green-400"></i>`;
        case 'pending': return `<i data-lucide="clock" class="h-3 w-3 text-gray-600"></i>`;
        default: return `<i data-lucide="help-circle" class="h-3 w-3 text-gray-600"></i>`;
      }
    };

    const activeTasks = this.state.tasks.filter(t => t.status === 'active');
    const completedTasks = this.state.tasks.filter(t => t.status === 'completed');
    const pendingTasks = this.state.tasks.filter(t => t.status === 'pending');

    const renderTasks = (title: string, tasks: ConversationTask[]) => {
      if (tasks.length === 0) {
        return '';
      }

      const list = tasks.map((task: ConversationTask) => `
        <div class="group relative h-[48px] cursor-pointer rounded-[6px] px-[8px] py-[6px] text-sm transition-colors hover:bg-white/[0.01]" style="border: 1px solid transparent; color: rgb(123, 136, 161);" title="${task.description}">
          <div class="flex min-w-0 items-center gap-1">
            <div class="flex items-center justify-center pr-[8px]">
              ${getStatusIcon(task.status)}
            </div>
            <div class="text-gray-400 min-w-0 flex-1 truncate text-[12px]" style="line-height: 140%; letter-spacing: 0px;">
              ${task.title}
            </div>
            <div class="flex h-[16px] flex-shrink-0 items-center gap-3 text-[10px]" style="opacity: 1;">
              ${task.linesAdded > 0 ? `<span class="text-[#A3BE8C]">+${task.linesAdded}</span>` : ''}
              ${task.linesRemoved > 0 ? `<span class="text-[#BF616A]">-${task.linesRemoved}</span>` : ''}
            </div>
          </div>
    
          <div class="flex items-center gap-2 whitespace-nowrap pl-[22px] text-[11px] text-gray-500" style="line-height: 150%; letter-spacing: 0.07px;">
            <span><i data-lucide="check-circle" class="h-3 w-3 text-green-400"></i> ${task.todos.completed}/${task.todos.total}</span>
            <span>•</span>
            <span class="truncate">${task.lastActivityTime} ago</span>
          </div>
        </div>
      `).join('');

      return ` <div class="flex flex-col gap-1">
            <div class="flex cursor-pointer items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-400" style="font-weight: 400; line-height: 150%; letter-spacing: 0.12px; white-space: nowrap;">
              <span>${title} (${tasks.length})</span>
              <div class="flex items-center justify-center transition-opacity duration-200 opacity-0">
                <div class="transition-transform duration-200">
                  <i data-lucide="chevron-down" class="h-2.5 w-2.5"></i>
                </div>
              </div>
            </div>
            ${list}
          </div>
          `;
    };

    this.container.innerHTML = `
      <div class="flex flex-col">
        <div class="flex flex-col gap-2 p-2">
          ${activeTasks.length > 0 ? renderTasks('Active Conversations', activeTasks) : ''}
          ${completedTasks.length > 0 ? renderTasks('Completed Conversations', completedTasks) : ''}
          ${pendingTasks.length > 0 ? renderTasks('Pending Conversations', pendingTasks) : ''}
        </div>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AgentOverlay());
} else {
  new AgentOverlay();
}