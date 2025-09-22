import Database from 'better-sqlite3';
import type {
  CursorConversation,
  BubbleMessage,
  ConversationSummary,
  ConversationFilters,
  SummaryOptions,
  DatabaseConfig,
} from './types.js';
import {
  createDefaultDatabaseConfig,
  extractComposerIdFromKey,
  generateBubbleIdKey,
  sanitizeMinConversationSize,
  sanitizeLimit,
} from '../utils/database-utils.js';
import {
  DatabaseError,
  DatabaseConnectionError,
  ConversationParseError,
} from '../utils/errors.js';
import { formatDistanceToNow, parseISO } from 'date-fns';

// Original code for Database parser taken from https://github.com/vltansky/cursor-chat-history-mcp
// Thanks for much for digging into the cursor database and making it work!

export class CursorDatabaseReader {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private cache: Map<string, any> = new Map();

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = { ...createDefaultDatabaseConfig(), ...config };
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      this.db = new Database(this.config.dbPath, { readonly: true });

      const testQuery = this.db.prepare('SELECT COUNT(*) as count FROM cursorDiskKV LIMIT 1');
      testQuery.get();
    } catch (error) {
      throw new DatabaseConnectionError(
        this.config.dbPath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.cache.clear();
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Ensure database is connected, with auto-reconnect
   */
  private async ensureConnected(): Promise<void> {
    if (!this.db) {
      await this.connect();
    }
  }

  /**
   * Get conversation IDs with optional filters (ordered by recency using ROWID)
   */
  async getConversationIds(filters?: ConversationFilters): Promise<string[]> {
    await this.ensureConnected();

    try {
      const _minLength = sanitizeMinConversationSize(filters?.minLength);
      const limit = sanitizeLimit(undefined, this.config.maxConversations);

      const whereConditions: string[] = [];
      const params: any[] = [];

      whereConditions.push("key LIKE 'composerData:%'");
      whereConditions.push('length(value) > ?');
      params.push(this.config.minConversationSize || 100);

      // All conversations are now modern format with _v field
      whereConditions.push("value LIKE '%\"_v\":%'");

      // Note: 24-hour filtering will be done at the application level
      // to ensure accurate time-based filtering using actual conversation data

      if (filters?.projectPath) {
        // Check if it's a full path or just a project name
        const isFullPath = filters.projectPath.startsWith('/');

        if (isFullPath) {
          // For full paths, search in all three places
          whereConditions.push('(value LIKE ? OR value LIKE ? OR value LIKE ?)');
          params.push(`%"attachedFoldersNew":[%"${filters.projectPath}%`);
          params.push(`%"relevantFiles":[%"${filters.projectPath}%`);
          params.push(`%"fsPath":"${filters.projectPath}%`);
        } else {
          // For project names, we need to search for the project name in paths
          whereConditions.push('(value LIKE ? OR value LIKE ? OR value LIKE ?)');
          params.push(`%"attachedFoldersNew":[%"${filters.projectPath}%`);
          params.push(`%"relevantFiles":[%"${filters.projectPath}%`);
          params.push(`%"fsPath":"%/${filters.projectPath}/%`);
        }
      }

      if (filters?.filePattern) {
        whereConditions.push('value LIKE ?');
        params.push(`%"relevantFiles":[%"${filters.filePattern}%`);
      }

      if (filters?.relevantFiles && filters.relevantFiles.length > 0) {
        const fileConditions = filters.relevantFiles.map(() => 'value LIKE ?');
        whereConditions.push(`(${fileConditions.join(' OR ')})`);
        filters.relevantFiles.forEach(file => {
          params.push(`%"relevantFiles":[%"${file}"%`);
        });
      }

      if (filters?.hasCodeBlocks) {
        whereConditions.push("value LIKE '%\"suggestedCodeBlocks\":[%'");
      }

      if (filters?.keywords && filters.keywords.length > 0) {
        const keywordConditions = filters.keywords.map(() => 'value LIKE ?');
        whereConditions.push(`(${keywordConditions.join(' OR ')})`);
        filters.keywords.forEach(keyword => {
          params.push(`%${keyword}%`);
        });
      }

      const sql = `
        SELECT key FROM cursorDiskKV
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ROWID DESC
        LIMIT ?
      `;
      params.push(limit);

      const stmt = this.db!.prepare(sql);
      const rows = stmt.all(...params) as Array<{ key: string }>;

      return rows.map(row => extractComposerIdFromKey(row.key)).filter(Boolean) as string[];
    } catch (error) {
      throw new DatabaseError(`Failed to get conversation IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation by ID (handles both legacy and modern formats)
   */
  async getConversationById(composerId: string): Promise<CursorConversation | null> {
    await this.ensureConnected();

    try {
      const cacheKey = `conversation:${composerId}`;
      if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const stmt = this.db!.prepare('SELECT value FROM cursorDiskKV WHERE key = ?');
      const row = stmt.get(`composerData:${composerId}`) as { value: string } | undefined;

      if (!row) {
        return null;
      }

      try {
        const conversation = JSON.parse(row.value) as CursorConversation;

        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, conversation);
        }

        return conversation;
      } catch (parseError) {
        throw new ConversationParseError('Failed to parse conversation data', composerId, parseError instanceof Error ? parseError : new Error(String(parseError)));
      }
    } catch (error) {
      if (error instanceof ConversationParseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get conversation ${composerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get individual message by bubble ID (for modern format)
   */
  async getBubbleMessage(composerId: string, bubbleId: string): Promise<BubbleMessage | null> {
    await this.ensureConnected();

    try {
      const cacheKey = `bubble:${composerId}:${bubbleId}`;
      if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const key = generateBubbleIdKey(composerId, bubbleId);
      const stmt = this.db!.prepare('SELECT value FROM cursorDiskKV WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;

      if (!row) {
        return null;
      }

      try {
        const message = JSON.parse(row.value) as BubbleMessage;

        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, message);
        }

        return message;
      } catch (parseError) {
        throw new ConversationParseError('Failed to parse bubble message data', composerId, parseError instanceof Error ? parseError : new Error(String(parseError)));
      }
    } catch (error) {
      if (error instanceof ConversationParseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get bubble message ${bubbleId} from conversation ${composerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation summary without full content
   */
  async getConversationSummary(composerId: string, options?: SummaryOptions): Promise<ConversationSummary | null> {
    await this.ensureConnected();

    const conversation = await this.getConversationById(composerId);
    if (!conversation) {
      return null;
    }

    const conversationSize = JSON.stringify(conversation).length;
    const modernConvo = conversation;

    // Extract data from modern conversation format
    const messageCount = modernConvo.fullConversationHeadersOnly.length;
    const title = modernConvo.name;

    let hasCodeBlocks = false;
    let codeBlockCount = 0;
    const relevantFiles = new Set<string>();
    const attachedFolders = new Set<string>();
    let firstMessage: string | undefined;
    let lastMessage: string | undefined;

    // For modern conversations, we need to resolve bubbles to get details
    // This can be slow, so we only do it if necessary based on options
    const needsBubbleResolution = options?.includeFirstMessage || options?.includeLastMessage || options?.includeCodeBlockCount || options?.includeFileList;

    if (needsBubbleResolution && this.config.resolveBubblesAutomatically) {
      for (const header of modernConvo.fullConversationHeadersOnly) {
        const bubble = await this.getBubbleMessage(composerId, header.bubbleId);
        if (bubble) {
          if (bubble.suggestedCodeBlocks && bubble.suggestedCodeBlocks.length > 0) {
            hasCodeBlocks = true;
            codeBlockCount += bubble.suggestedCodeBlocks.length;
          }
          bubble.relevantFiles?.forEach(file => relevantFiles.add(file));
          bubble.attachedFoldersNew?.forEach(folder => attachedFolders.add(folder));

          if (!firstMessage) {
            firstMessage = bubble.text;
          }
          lastMessage = bubble.text;
        }
      }
    }

    // Truncate messages if requested
    if (options?.includeFirstMessage && firstMessage) {
      firstMessage = firstMessage.substring(0, options.maxFirstMessageLength || 250);
    } else {
      firstMessage = undefined;
    }

    if (options?.includeLastMessage && lastMessage) {
      lastMessage = lastMessage.substring(0, options.maxLastMessageLength || 250);
    } else {
      lastMessage = undefined;
    }

    const lastActivityTime = await this.getLastActivityTime(conversation);

    const summary: ConversationSummary = {
      appName: 'cursor',
      projectName: this.getCommonFolderName(Object.keys(conversation.codeBlockData)) || 'unknown',
      composerId,
      messageCount,
      hasCodeBlocks,
      codeBlockCount: options?.includeCodeBlockCount ? codeBlockCount : 0,
      relevantFiles: options?.includeFileList ? Array.from(relevantFiles) : [],
      attachedFolders: options?.includeAttachedFolders ? Array.from(attachedFolders) : [],
      firstMessage,
      lastMessage,
      storedSummary: options?.includeStoredSummary ? conversation.text : undefined,
      storedRichText: options?.includeStoredSummary ? conversation.richText : undefined,
      title: options?.includeTitle ? title : undefined,
      aiGeneratedSummary: undefined, // Modern format doesn't have latestConversationSummary
      conversationSize,
      linesAdded: conversation.totalLinesAdded,
      linesRemoved: conversation.totalLinesRemoved,
      todos: {
        completed: conversation.todos.filter(todo => todo.status === 'completed').length,
        total: conversation.todos.length,
        firstInProgress: conversation.todos.find(todo => todo.status === 'active')?.id || undefined,
      },
      lastActivityTime: lastActivityTime.string,
      lastActivityTimeMsAgo: lastActivityTime.msAgo,
      model: conversation?.modelConfig?.modelName || 'unknown',
      hasBlockingPendingActions: conversation.hasBlockingPendingActions,
    };

    return summary;
  }
  

  private async getLastActivityTime(conversation: CursorConversation): Promise<{ string: string, msAgo: number }> {
    // get last bubble and read time diff
    const lastBubbleId = conversation.fullConversationHeadersOnly[conversation.fullConversationHeadersOnly.length - 1]?.bubbleId;
    const lastBubble = await this.getBubbleMessage(conversation.composerId, lastBubbleId);

    // Handle invalid or missing dates gracefully
    const createdAt = lastBubble?.createdAt;
    if (!createdAt || createdAt.trim() === '') {
      return {
        string: 'unknown',
        msAgo: 0,
      };
    }

    try {
      const lastBubbleTime = parseISO(createdAt);
      if (isNaN(lastBubbleTime.getTime())) {
        return {
          string: 'unknown',
          msAgo: 0,
        };
      }

      return {
        string: formatDistanceToNow(lastBubbleTime),
        msAgo: Date.now() - lastBubbleTime.getTime(),
      };
    } catch {
      return {
        string: 'unknown',
        msAgo: 0,
      };
    }
  }

  private getCommonFolderName(paths: string[]): string | null {
    if (!paths.length) return null;

    const blacklist = new Set([
      'src', 'dist', 'build', 'out', 'lib', 'node_modules',
      'tests', 'test', '__pycache__', 'venv',
    ]);

    // split paths
    const splitPaths = paths.map(p => p.split('/').filter(Boolean));
    const minLen = Math.min(...splitPaths.map(p => p.length));

    const common: string[] = [];
    for (let i = 0; i < minLen; i++) {
      const segment = splitPaths[0][i];
      if (splitPaths.every(p => p[i] === segment)) {
        common.push(segment);
      } else {
        break;
      }
    }

    if (!common.length) return null;

    // Find the last valid folder
    for (let i = common.length - 1; i >= 0; i--) {
      const folder = common[i];
      if (!blacklist.has(folder) && !folder.includes('.')) {
        return folder;
      }
    }

    return null;
  }
}