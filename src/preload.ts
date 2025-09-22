import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
  log: (level: string, message: string) => ipcRenderer.invoke('log', level, message),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.invoke('set-ignore-mouse-events', ignore),
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', width, height),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  getRecentChats: (limit: number) => ipcRenderer.invoke('get-recent-chats', limit),
  getConversationStats: () => ipcRenderer.invoke('get-conversation-stats'),
  getConversationsWithCode: (limit: number) => ipcRenderer.invoke('get-conversations-with-code', limit),
  searchConversations: (query: string, limit: number) => ipcRenderer.invoke('search-conversations', query, limit),
  getTaskSummaries: (limit: number) => ipcRenderer.invoke('get-task-summaries', limit),
  onChatsUpdate: (callback: (chats: any[]) => void) => {
    ipcRenderer.on('chats-update', (event, chats) => callback(chats));
  },
  onDatabaseChanged: (callback: () => void) => {
    const wrappedCallback = () => {
      console.log('🎯 Preload: database-changed event received, calling callback');
      callback();
    };
    console.log('🔗 Preload: Setting up database-changed listener');
    ipcRenderer.on('database-changed', wrappedCallback);
    return () => {
      console.log('🧹 Preload: Removing database-changed listener');
      ipcRenderer.removeListener('database-changed', wrappedCallback);
    };
  },
});