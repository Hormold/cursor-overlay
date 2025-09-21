import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getRecentChats: (limit: number) => ipcRenderer.invoke('get-recent-chats', limit),
  getConversationStats: () => ipcRenderer.invoke('get-conversation-stats'),
  getConversationsWithCode: (limit: number) => ipcRenderer.invoke('get-conversations-with-code', limit),
  searchConversations: (query: string, limit: number) => ipcRenderer.invoke('search-conversations', query, limit),
  getTaskSummaries: (limit: number) => ipcRenderer.invoke('get-task-summaries', limit),
  onChatsUpdate: (callback: (chats: any[]) => void) => {
    ipcRenderer.on('chats-update', (event, chats) => callback(chats));
  }
});