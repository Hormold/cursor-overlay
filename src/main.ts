import { app, BrowserWindow, screen, ipcMain, Tray, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { CursorDatabaseReader } from './database/reader';
import { ClaudeJsonlReader } from './database/claude-jsonl-reader';
import { detectDatabasePath } from './utils/database-utils';
import { saveWindowState, loadWindowState } from './utils/window-state';
import { log } from './utils/logger';

let mainWindow: BrowserWindow | null = null;
let dbReader: CursorDatabaseReader | null = null;
let claudeReader: ClaudeJsonlReader | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const savedState = loadWindowState();
  
  log('🪟 Loading window state:', savedState);
  log('🖥️ Screen width:', width);
  
  mainWindow = new BrowserWindow({
    width: savedState?.width || 640,
    height: savedState?.height || 400,
    x: savedState?.x || Math.floor(width / 2 - 300),
    y: savedState?.y || 100,
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
      nodeIntegration: false,
    },
  });

  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setBackgroundColor('#00000000');
  mainWindow.loadFile(path.join(__dirname, '../index.html'));
  
  // Open DevTools for debugging (only in dev mode)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  
  // Restore saved position after a small delay to ensure screen is ready
  if (savedState) {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        log('🔄 Restoring position after delay:', savedState);
        mainWindow.setBounds({
          x: savedState.x,
          y: savedState.y,
          width: savedState.width,
          height: savedState.height,
        });
      }
    }, 100);
  }
  
  mainWindow.on('moved', () => saveWindowState(mainWindow!));
  mainWindow.on('resized', () => saveWindowState(mainWindow!));
  
  mainWindow.on('closed', () => {
    if (mainWindow) saveWindowState(mainWindow);
    mainWindow = null;
  });
}

function createTray(): void {
  tray = new Tray(createTextIcon());
  tray.setToolTip('Cursor Overlay');
  tray.on('click', toggleWindowVisibility);
}

function createTextIcon(): Electron.NativeImage {
  // Create a simple 16x16 pixel buffer for the icon
  const buffer = Buffer.alloc(16 * 16 * 4); // RGBA

  // Fill with background color (dark gray)
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 0x33;     // R
    buffer[i + 1] = 0x33; // G
    buffer[i + 2] = 0x33; // B
    buffer[i + 3] = 0xFF; // A
  }

  // Add a simple "C" shape using lighter pixels
  const drawPixel = (x: number, y: number, r: number, g: number, b: number) => {
    const index = (y * 16 + x) * 4;
    buffer[index] = r;
    buffer[index + 1] = g;
    buffer[index + 2] = b;
    buffer[index + 3] = 0xFF;
  };

  // Draw a simple "C" shape
  for (let y = 3; y < 13; y++) {
    drawPixel(5, y, 0xFF, 0xFF, 0xFF); // Left vertical line
    drawPixel(6, y, 0xFF, 0xFF, 0xFF);
  }
  for (let x = 5; x < 12; x++) {
    drawPixel(x, 2, 0xFF, 0xFF, 0xFF); // Top horizontal
    drawPixel(x, 3, 0xFF, 0xFF, 0xFF);
    drawPixel(x, 12, 0xFF, 0xFF, 0xFF); // Bottom horizontal
    drawPixel(x, 13, 0xFF, 0xFF, 0xFF);
  }

  return nativeImage.createFromBuffer(buffer, { width: 16, height: 16 });
}

function toggleWindowVisibility(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}


async function initializeDatabase(): Promise<void> {
  // Initialize Cursor database
  try {
    const dbPath = detectDatabasePath();
    dbReader = new CursorDatabaseReader({
      dbPath,
      maxConversations: 50,
    });

    await dbReader.connect();
    setupDatabaseWatcher(dbPath);
    log('✅ Cursor database connected');
  } catch (error) {
    console.error('❌ Failed to connect to Cursor database:', error);
  }

  // Initialize Claude JSONL reader
  try {
    claudeReader = new ClaudeJsonlReader({
      maxSessions: 50,
      includeSummaries: true,
    });
    log('✅ Claude Code JSONL reader initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Claude Code reader:', error);
  }
}

function setupDatabaseWatcher(dbPath: string): void {
  try {
    // Check if file exists first
    if (!fs.existsSync(dbPath)) {
      setTimeout(() => {
        if (fs.existsSync(dbPath)) {
          setupDatabaseWatcher(dbPath);
        }
      }, 5000);
      return;
    }

    // Watch for changes to the database file
    const watcher = fs.watch(dbPath, { persistent: false }, (eventType) => {
      if ((eventType === 'change' || eventType === 'rename') && mainWindow) {
        log('🔄 Database changed, clearing cache and notifying renderer...');
        if (dbReader) {
          dbReader.clearCache();
          log('🗑️ Cache cleared');
        }
        log('📨 Main: webContents ready?', !mainWindow.webContents.isDestroyed());
        mainWindow.webContents.send('database-changed');
        log('✅ Main: database-changed event sent');
      }
    });

    // Clean up watcher when app quits
    app.on('before-quit', () => watcher.close());
  } catch (error) {
    console.error('❌ Failed to set up database watcher:', error);
  }
}

// IPC handlers for database queries and events
ipcMain.handle('log', async (_event, _level: string, message: string) => {
  log(`[RENDERER] ${message}`);
});

ipcMain.handle('get-recent-chats', async (_event, limit: number = 20) => {
  const allChats: Array<{ source: string; [key: string]: unknown }> = [];
  const errors: string[] = [];

  // Get Cursor chats
  if (dbReader) {
    try {
      const conversations = await dbReader.getConversationIds();
      const recentConversations = conversations.slice(0, Math.floor(limit / 2));

      const summaries = await Promise.all(
        recentConversations.map(async (id) => {
          try {
            if (!dbReader) return null;
            const summary = await dbReader.getConversationSummary(id, {
              includeFirstMessage: true,
              includeLastMessage: true,
              maxFirstMessageLength: 100,
              maxLastMessageLength: 100,
              includeTitle: true,
              includeCodeBlockCount: true,
              includeFileList: true,
              includeMetadata: true,
            });
            return summary ? { ...summary, source: 'cursor' } : null;
          } catch (err: unknown) {
            console.error('Failed to get conversation summary:', err);
            return null;
          }
        }),
      );

      const validSummaries = summaries.filter(s => s !== null);
      allChats.push(...validSummaries);
    } catch (error: unknown) {
      console.error('Failed to fetch Cursor chats:', error);
      errors.push(`Cursor: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('Cursor database not connected');
  }

  // Get Claude chats
  if (claudeReader) {
    try {
      const sessions = claudeReader.getRecentSessions(Math.floor(limit / 2));
      const claudeChats = sessions.map(session => ({ ...session, source: 'claude' }));
      allChats.push(...claudeChats);
    } catch (error: unknown) {
      console.error('Failed to fetch Claude chats:', error);
      errors.push(`Claude: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('Claude reader not initialized');
  }

  // Sort by last activity (most recent first)
  allChats.sort((a, b) => {
    const aTime = (a.lastActivityTimeMsAgo as number) || 0;
    const bTime = (b.lastActivityTimeMsAgo as number) || 0;
    return aTime - bTime; // Lower ms ago = more recent
  });

  return {
    data: allChats.slice(0, limit),
    errors: errors.length > 0 ? errors : undefined,
    sources: {
      cursor: dbReader ? 'connected' : 'disconnected',
      claude: claudeReader ? 'connected' : 'disconnected',
    },
  };
});

// IPC handlers for mouse events  
ipcMain.handle('set-ignore-mouse-events', async (_event, ignore: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.handle('hide-window', async () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('resize-window', async (_event, width: number, height: number) => {
  if (mainWindow) {
    log('🔄 Resizing window to:', width, height);
    const currentBounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: Math.max(320, Math.min(800, width + 40)), // padding + constraints
      height: Math.max(100, Math.min(600, height + 40)),
    });
  }
});

app.whenReady().then(async () => {
  await initializeDatabase();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (dbReader) {
    dbReader.close();
  }
  // Claude JSONL reader doesn't need closing
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (mainWindow) saveWindowState(mainWindow);
  if (tray) {
    tray.destroy();
    tray = null;
  }
});