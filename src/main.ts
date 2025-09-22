import { app, BrowserWindow, screen, ipcMain, Tray, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { CursorDatabaseReader } from './database/reader';
import { detectDatabasePath } from './utils/database-utils';

let mainWindow: BrowserWindow | null = null;
let dbReader: CursorDatabaseReader | null = null;
let tray: Tray | null = null;
let lastResize = { width: 0, height: 0 };

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 640,
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
  
  mainWindow.on('closed', () => {
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
  try {
    const dbPath = detectDatabasePath();
    dbReader = new CursorDatabaseReader({
      dbPath,
      maxConversations: 50,
    });

    await dbReader.connect();
    setupDatabaseWatcher(dbPath);
  } catch (error) {
    console.error('Failed to connect to database:', error);
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
    const watcher = fs.watch(dbPath, { persistent: false }, (eventType, filename) => {
      if ((eventType === 'change' || eventType === 'rename') && mainWindow) {
        console.log('🔄 Database changed, clearing cache and notifying renderer...');
        if (dbReader) {
          dbReader.clearCache();
          console.log('🗑️ Cache cleared');
        }
        console.log('📨 Main: webContents ready?', !mainWindow.webContents.isDestroyed());
        mainWindow.webContents.send('database-changed');
        console.log('✅ Main: database-changed event sent');
      }
    });

    // Clean up watcher when app quits
    app.on('before-quit', () => watcher.close());
  } catch (error) {
    console.error('❌ Failed to set up database watcher:', error);
  }
}

// IPC handlers for database queries and events
ipcMain.handle('log', async (event, level: string, message: string) => {
  console.log(`[RENDERER] ${message}`);
});

ipcMain.handle('get-recent-chats', async (event, limit: number = 20) => {
  if (!dbReader) {
    return { error: 'Database not connected' };
  }

  try {
    const conversations = await dbReader.getConversationIds();
    const recentConversations = conversations.slice(0, limit);

    const summaries = await Promise.all(
      recentConversations.map(async (id) => {
        try {
          return await dbReader!.getConversationSummary(id, {
            includeFirstMessage: true,
            includeLastMessage: true,
            maxFirstMessageLength: 100,
            maxLastMessageLength: 100,
            includeTitle: true,
            includeCodeBlockCount: true,
            includeFileList: true,
            includeMetadata: true,
          });
        } catch (err) {
          return null;
        }
      }),
    );

    const validSummaries = summaries.filter(s => s !== null);
    return { data: validSummaries };
  } catch (error) {
    return { error: 'Failed to fetch chats' };
  }
});

// IPC handlers for mouse events  
ipcMain.handle('set-ignore-mouse-events', async (_event, ignore: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.handle('hide-window', async (event) => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('resize-window', async (event, width: number, height: number) => {
  if (mainWindow) {
    console.log('🔄 Resizing window to:', width, height);
    const currentBounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: Math.max(320, Math.min(800, width + 40)), // padding + constraints
      height: Math.max(100, Math.min(600, height + 40)),
    });
    lastResize = { width, height };
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
  if (tray) {
    tray.destroy();
    tray = null;
  }
});