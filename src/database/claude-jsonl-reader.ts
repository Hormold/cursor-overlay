import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { formatDistanceToNow } from 'date-fns';
import { log } from '../utils/logger';

export interface ClaudeMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'summary';
  message?: {
    role: string;
    content: Array<{
      type: string;
      text?: string;
      tool_use_id?: string;
      content?: string;
    }> | string;
  };
  cwd: string;
  gitBranch?: string;
  version: string;
}

export interface ClaudeSummary {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

export interface ClaudeSession {
  // Unified format matching Cursor ConversationSummary
  projectName: string;
  composerId: string;
  messageCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  relevantFiles: string[];
  attachedFolders: string[];
  firstMessage?: string;
  lastMessage?: string;
  storedSummary?: string;
  title?: string;
  conversationSize: number;
  linesAdded: number;
  linesRemoved: number;
  todos: {
    completed: number;
    total: number;
    firstInProgress: string | undefined;
  };
  lastActivityTime: string;
  lastActivityTimeMsAgo: number;
  model: string;
  hasBlockingPendingActions: boolean;
}

export interface ClaudeJsonlReaderConfig {
  maxSessions?: number;
  includeSummaries?: boolean;
}

export class ClaudeJsonlReader {
  private config: ClaudeJsonlReaderConfig;
  private claudeProjectsPath: string;

  constructor(config: ClaudeJsonlReaderConfig = {}) {
    this.config = {
      maxSessions: 50,
      includeSummaries: true,
      ...config,
    };
    this.claudeProjectsPath = path.join(homedir(), '.claude', 'projects');
  }

  /**
   * Get all available projects (each project folder contains sessions)
   */
  getProjects(): string[] {
    if (!fs.existsSync(this.claudeProjectsPath)) {
      return [];
    }

    return fs.readdirSync(this.claudeProjectsPath)
      .filter(item => {
        const fullPath = path.join(this.claudeProjectsPath, item);
        return fs.statSync(fullPath).isDirectory() && !item.startsWith('.');
      });
  }

  /**
   * Get all JSONL session files for a project
   */
  getProjectSessions(projectName: string): string[] {
    const projectPath = path.join(this.claudeProjectsPath, projectName);
    
    if (!fs.existsSync(projectPath)) {
      return [];
    }

    return fs.readdirSync(projectPath)
      .filter(file => file.endsWith('.jsonl'))
      .map(file => path.join(projectPath, file))
      .sort((a, b) => {
        // Sort by modification time, newest first
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
  }

  /**
   * Parse a single JSONL session file
   */
  parseSessionFile(filePath: string): ClaudeSession | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return null;
      }

      const messages: ClaudeMessage[] = [];
      const summaries: ClaudeSummary[] = [];
      
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          
          if (record.type === 'summary') {
            summaries.push(record as ClaudeSummary);
          } else {
            messages.push(record as ClaudeMessage);
          }
        } catch {
          // Skip invalid JSONL lines
          continue;
        }
      }

      if (messages.length === 0) {
        return null;
      }

      // Extract session info from the first message
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];
      
      // Generate title from first user message or use summary
      let title = 'Claude Session';
      if (summaries.length > 0) {
        title = summaries[0].summary;
      } else {
        const firstUserMessage = messages.find(m => m.type === 'user');
        if (firstUserMessage?.message?.content) {
          const content = firstUserMessage.message.content;
          if (Array.isArray(content)) {
            const textContent = content.find(c => c.type === 'text')?.text;
            if (textContent) {
              title = textContent.substring(0, 60).trim() + (textContent.length > 60 ? '...' : '');
            }
          } else if (typeof content === 'string') {
            title = content.substring(0, 60).trim() + (content.length > 60 ? '...' : '');
          }
        }
      }

      const lastActivityTime = new Date(lastMessage.timestamp);
      
      // Extract todos from TodoWrite tool calls
      const todoStats = this.extractTodoStats(messages);
      
      // Extract project name from cwd
      const projectName = this.extractProjectName(firstMessage.cwd);

      return {
        projectName,
        composerId: firstMessage.sessionId,
        messageCount: messages.length,
        hasCodeBlocks: this.hasCodeBlocks(messages),
        codeBlockCount: this.countCodeBlocks(messages),
        relevantFiles: this.extractRelevantFiles(messages),
        attachedFolders: [firstMessage.cwd],
        firstMessage: this.extractMessageText(messages.find(m => m.type === 'user')),
        lastMessage: this.extractMessageText(lastMessage),
        storedSummary: summaries.length > 0 ? summaries[0].summary : undefined,
        title,
        conversationSize: 0, // Could calculate from JSONL file size
        linesAdded: 0, // Would need git integration
        linesRemoved: 0, // Would need git integration
        todos: todoStats,
        lastActivityTime: formatDistanceToNow(lastActivityTime),
        lastActivityTimeMsAgo: Date.now() - lastActivityTime.getTime(),
        model: this.extractModel(messages),
        hasBlockingPendingActions: this.hasBlockingPendingActions(messages),
      };
    } catch (error) {
      log('Failed to parse session file:', filePath, error);
      return null;
    }
  }

  /**
   * Get recent sessions across all projects
   */
  getRecentSessions(limit?: number): ClaudeSession[] {
    const maxSessions = limit || this.config.maxSessions || 50;
    const sessions: ClaudeSession[] = [];
    
    const projects = this.getProjects();
    
    // Collect all session files with their modification times
    const allSessionFiles: { path: string; mtime: number }[] = [];
    
    for (const project of projects) {
      const projectSessions = this.getProjectSessions(project);
      for (const sessionPath of projectSessions) {
        try {
          const stat = fs.statSync(sessionPath);
          allSessionFiles.push({
            path: sessionPath,
            mtime: stat.mtime.getTime(),
          });
        } catch (error) {
          log('Failed to stat session file:', sessionPath, error);
        }
      }
    }
    
    // Sort by modification time, newest first
    allSessionFiles.sort((a, b) => b.mtime - a.mtime);
    
    // Parse the most recent sessions
    for (const sessionFile of allSessionFiles.slice(0, maxSessions)) {
      const session = this.parseSessionFile(sessionFile.path);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Get sessions for a specific project path
   */
  getSessionsForProject(projectPath: string): ClaudeSession[] {
    // Convert full project path to Claude projects folder name
    const projectName = projectPath.replace(/\//g, '-').replace(/^-/, '');
    const sessions: ClaudeSession[] = [];
    
    const sessionFiles = this.getProjectSessions(projectName);
    
    for (const sessionFile of sessionFiles) {
      const session = this.parseSessionFile(sessionFile);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  private extractMessageText(message?: ClaudeMessage): string | undefined {
    if (!message?.message?.content) {
      return undefined;
    }
    
    const content = message.message.content;
    
    if (Array.isArray(content)) {
      const textContent = content.find(c => c.type === 'text')?.text;
      if (textContent) {
        return textContent.substring(0, 200).trim();
      }
    } else if (typeof content === 'string') {
      return content.substring(0, 200).trim();
    }
    
    return undefined;
  }

  private extractTodoStats(messages: ClaudeMessage[]): { completed: number; total: number; firstInProgress: string | undefined } {
    let latestTodos: Array<{ content: string; status: string }> = [];
    
    // Find the most recent TodoWrite tool call
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.message?.content && Array.isArray(message.message.content)) {
        for (const content of message.message.content) {
          if (content.type === 'tool_use' && (content as any).name === 'TodoWrite') {
            const todos = (content as any).input?.todos;
            if (Array.isArray(todos)) {
              latestTodos = todos;
              break;
            }
          }
        }
        if (latestTodos.length > 0) break;
      }
    }
    
    const completed = latestTodos.filter(t => t.status === 'completed').length;
    const firstInProgress = latestTodos.find(t => t.status === 'in_progress')?.content;
    
    return {
      completed,
      total: latestTodos.length,
      firstInProgress,
    };
  }

  private extractProjectName(cwd: string): string {
    const parts = cwd.split('/');
    return parts[parts.length - 1] || 'Unknown Project';
  }

  private hasCodeBlocks(messages: ClaudeMessage[]): boolean {
    return messages.some(m => {
      const content = m.message?.content;
      return Array.isArray(content) && content.some(c => 
        c.type === 'tool_use' && ['Write', 'Edit', 'MultiEdit'].includes((c as any).name || ''),
      );
    });
  }

  private countCodeBlocks(messages: ClaudeMessage[]): number {
    let count = 0;
    for (const message of messages) {
      const content = message.message?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'tool_use' && ['Write', 'Edit', 'MultiEdit'].includes((item as any).name || '')) {
            count++;
          }
        }
      }
    }
    return count;
  }

  private extractRelevantFiles(messages: ClaudeMessage[]): string[] {
    const files = new Set<string>();
    
    for (const message of messages) {
      const content = message.message?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'tool_use') {
            const toolName = (item as any).name;
            const input = (item as any).input;
            
            if (['Write', 'Edit', 'MultiEdit', 'Read'].includes(toolName) && input?.file_path) {
              files.add(input.file_path);
            }
          }
        }
      }
    }
    
    return Array.from(files);
  }

  private extractModel(_messages: ClaudeMessage[]): string {
    return 'Claude';
  }

  private hasBlockingPendingActions(messages: ClaudeMessage[]): boolean {
    if (messages.length === 0) return false;
    
    const lastMessage = messages[messages.length - 1];
    
    // If last message is from assistant, check if it's a tool_use (waiting for result)
    if (lastMessage.type === 'assistant') {
      const content = lastMessage.message?.content;
      if (Array.isArray(content)) {
        const hasToolUse = content.some(c => c.type === 'tool_use');
        if (hasToolUse) {
          return true; // Waiting for tool result
        }
      }
      return false; // Assistant finished with text response
    }
    
    // If last message is from user, check if it's a tool result or new input
    if (lastMessage.type === 'user') {
      const content = lastMessage.message?.content;
      if (Array.isArray(content)) {
        const isToolResult = content.some(c => c.type === 'tool_result');
        return isToolResult; // Tool result means assistant should respond
      }
      return true; // New user input waiting for assistant
    }
    
    return false;
  }
}