import { app, screen, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { log } from './logger.js';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getWindowStateFilePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

export function saveWindowState(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;
  
  try {
    const bounds = window.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
      
    const content = JSON.stringify(state, null, 2);
    if (content && content.length > 10) { // Sanity check
      fs.writeFileSync(getWindowStateFilePath(), content);
    } else {
      log('⚠️ Refusing to save empty/invalid window state');
    }
  } catch (error) {
    log('❌ Failed to save window state:', error);
  }
}

export function loadWindowState(): WindowState | null {
  const filePath = getWindowStateFilePath();
  log('🔍 Loading window state from:', filePath);
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    log('📄 Raw file content:', data);
    
    if (!data || data.trim().length === 0) {
      log('⚠️ Window state file is empty');
      throw new Error('Empty file');
    }
    
    const state = JSON.parse(data) as WindowState;
    log('📦 Parsed window state:', state);
    
    // Validate the state is within screen bounds
    const displays = screen.getAllDisplays();
    log('🖥️ Available displays:', displays.map(d => d.bounds));
    
    const isValidPosition = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return state.x >= x && state.x < x + width && 
             state.y >= y && state.y < y + height;
    });
    
    log('✅ Position valid:', isValidPosition);
    return isValidPosition ? state : null;
  } catch (error) {
    log('❌ Failed to load window state:', error);
    // If JSON is corrupted, delete it and start fresh
    try {
      fs.unlinkSync(filePath);
      log('🗑️ Deleted corrupted window state file');
    } catch {
      // Ignore deletion errors
    }
    return null;
  }
}