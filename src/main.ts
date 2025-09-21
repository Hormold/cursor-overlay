import { app, BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { CursorDatabaseReader } from './database/reader';
import { detectDatabasePath, detectOperatingSystem, getCursorDatabasePaths } from './utils/database-utils';

let mainWindow: BrowserWindow | null = null;
let dbReader: CursorDatabaseReader | null = null;

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    x: Math.floor(width / 2 - 300),
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setBackgroundColor('#00000000');
  mainWindow.loadFile(path.join(__dirname, '../index.html'));
  
  // Open DevTools for debugging (only in dev mode)
  //if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  //}
  
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeDatabase(): Promise<void> {
  try {
    const dbPath = detectDatabasePath();
    console.log('Connecting to database at:', dbPath);
    
    dbReader = new CursorDatabaseReader({ 
      dbPath,
      maxConversations: 50
    });
    
    await dbReader.connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

// IPC handlers for database queries
ipcMain.handle('get-recent-chats', async (event, limit: number = 20) => {
  console.log('=== get-recent-chats called with limit:', limit);
  
  if (!dbReader) {
    console.log('❌ Database reader not available');
    return { error: 'Database not connected' };
  }
  
  try {
    console.log('📊 Getting conversation IDs...');
    const conversations = await dbReader.getConversationIds();
    console.log(`✅ Found ${conversations.length} total conversations`);
    
    const recentConversations = conversations.slice(0, limit);
    console.log(`📝 Processing ${recentConversations.length} recent conversations:`, recentConversations);
    
    const summaries = await Promise.all(
      recentConversations.map(async (id, index) => {
        console.log(`🔍 Processing conversation ${index + 1}/${recentConversations.length}: ${id}`);
        try {
          const summary = await dbReader!.getConversationSummary(id, {
            includeFirstMessage: true,
            includeLastMessage: true,
            maxFirstMessageLength: 100,
            maxLastMessageLength: 100,
            includeTitle: true,
            includeCodeBlockCount: true,
            includeFileList: true,
            includeMetadata: true
          });
        
          
          return summary;
        } catch (err) {
          console.error(`❌ Error processing conversation ${id}:`, err);
          return null;
        }
      })
    );
    
    const validSummaries = summaries.filter(s => s !== null);
    console.log(`📋 Returning ${validSummaries.length} valid summaries`);
    
    return { data: validSummaries };
  } catch (error) {
    console.error('❌ Error fetching chats:', error);
    return { error: 'Failed to fetch chats' };
  }
});


app.whenReady().then(async () => {
  await initializeDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (dbReader) {
    dbReader.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});