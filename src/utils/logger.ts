import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function log(message: string, data?: unknown, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
  console.log(logMessage, ...args);
  
  try {
    const logFile = path.join(app.getPath('userData'), 'window-state.log');
    fs.appendFileSync(logFile, `${logMessage}\n`);
  } catch {
    // Ignore log file errors
  }
}