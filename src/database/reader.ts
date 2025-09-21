import Database from 'better-sqlite3';
import type {
  CursorConversation,
  ModernCursorConversation,
  BubbleMessage,
  ConversationSummary,
  ConversationSearchResult,
  ConversationStats,
  ConversationFilters,
  SummaryOptions,
  DatabaseConfig,
  SearchMatch
} from './types.js';
import {
  isModernConversation
} from './types.js';
import { ConversationParser } from './parser.js';
import {
  validateDatabasePath,
  createDefaultDatabaseConfig,
  extractComposerIdFromKey,
  generateBubbleIdKey,
  sanitizeMinConversationSize,
  sanitizeLimit,
  createFilePatternLike,
  sanitizeSearchQuery
} from '../utils/database-utils.js';
import {
  DatabaseError,
  DatabaseConnectionError,
  ConversationNotFoundError,
  BubbleMessageNotFoundError,
  ConversationParseError,
  SearchError,
  ValidationError
} from '../utils/errors.js';
import { formatDistanceToNow, parseISO } from 'date-fns';

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
        error instanceof Error ? error : new Error(String(error))
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
   * Ensure database is connected
   */
  private ensureConnected(): void {
    if (!this.db) {
      throw new DatabaseError('Database not connected. Call connect() first.');
    }
  }

  /**
   * Get conversation IDs with optional filters (ordered by recency using ROWID)
   */
  async getConversationIds(filters?: ConversationFilters): Promise<string[]> {
    this.ensureConnected();

    try {
      const minLength = sanitizeMinConversationSize(filters?.minLength);
      const limit = sanitizeLimit(undefined, this.config.maxConversations);

      let whereConditions: string[] = [];
      let params: any[] = [];

      whereConditions.push("key LIKE 'composerData:%'");
      whereConditions.push('length(value) > ?');
      params.push(this.config.minConversationSize || 100);

      // All conversations are now modern format with _v field
      whereConditions.push("value LIKE '%\"_v\":%'");

      if (filters?.projectPath) {
        // Check if it's a full path or just a project name
        const isFullPath = filters.projectPath.startsWith('/');

        if (isFullPath) {
          // For full paths, search in all three places
          whereConditions.push("(value LIKE ? OR value LIKE ? OR value LIKE ?)");
          params.push(`%"attachedFoldersNew":[%"${filters.projectPath}%`);
          params.push(`%"relevantFiles":[%"${filters.projectPath}%`);
          params.push(`%"fsPath":"${filters.projectPath}%`);
        } else {
          // For project names, we need to search for the project name in paths
          whereConditions.push("(value LIKE ? OR value LIKE ? OR value LIKE ?)");
          params.push(`%"attachedFoldersNew":[%"${filters.projectPath}%`);
          params.push(`%"relevantFiles":[%"${filters.projectPath}%`);
          params.push(`%"fsPath":"%/${filters.projectPath}/%`);
        }
      }

      if (filters?.filePattern) {
        whereConditions.push("value LIKE ?");
        params.push(`%"relevantFiles":[%"${filters.filePattern}%`);
      }

      if (filters?.relevantFiles && filters.relevantFiles.length > 0) {
        const fileConditions = filters.relevantFiles.map(() => "value LIKE ?");
        whereConditions.push(`(${fileConditions.join(' OR ')})`);
        filters.relevantFiles.forEach(file => {
          params.push(`%"relevantFiles":[%"${file}"%`);
        });
      }

      if (filters?.hasCodeBlocks) {
        whereConditions.push("value LIKE '%\"suggestedCodeBlocks\":[%'");
      }

      if (filters?.keywords && filters.keywords.length > 0) {
        const keywordConditions = filters.keywords.map(() => "value LIKE ?");
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
   * Extract project paths from conversation context field
   */
  private extractProjectPathsFromContext(conversation: any): string[] {
    const projectPaths = new Set<string>();

    // Check top-level context
    if (conversation.context?.fileSelections) {
      for (const selection of conversation.context.fileSelections) {
        const fsPath = selection.uri?.fsPath || selection.uri?.path;
        if (fsPath) {
          const projectName = this.extractProjectName(fsPath);
          if (projectName) {
            projectPaths.add(projectName);
            projectPaths.add(fsPath); // Also add full path for exact matching
          }
        }
      }
    }

    // Check message-level context for legacy format
    if (conversation.conversation && Array.isArray(conversation.conversation)) {
      for (const message of conversation.conversation) {
        if (message.context?.fileSelections) {
          for (const selection of message.context.fileSelections) {
            const fsPath = selection.uri?.fsPath || selection.uri?.path;
            if (fsPath) {
              const projectName = this.extractProjectName(fsPath);
              if (projectName) {
                projectPaths.add(projectName);
                projectPaths.add(fsPath); // Also add full path for exact matching
              }
            }
          }
        }
      }
    }

    return Array.from(projectPaths);
  }

    /**
   * Extract project name from file path
   */
  private extractProjectName(filePath: string): string {
    // Extract project name from path like "/Users/vladta/Projects/editor-elements/file.ts"
    const parts = filePath.split('/').filter(Boolean); // Remove empty parts

    // Look for "Projects" folder (case-insensitive)
    const projectsIndex = parts.findIndex(part => part.toLowerCase() === 'projects');
    if (projectsIndex >= 0 && projectsIndex < parts.length - 1) {
      return parts[projectsIndex + 1];
    }

    // Fallback: try to find common workspace patterns
    const workspacePatterns = ['workspace', 'repos', 'code', 'dev', 'development', 'src', 'work'];
    for (const pattern of workspacePatterns) {
      const patternIndex = parts.findIndex(part => part.toLowerCase() === pattern);
      if (patternIndex >= 0 && patternIndex < parts.length - 1) {
        return parts[patternIndex + 1];
      }
    }

    // For paths like /Users/username/project-name/..., take the project name
    // Skip common user directory patterns
    const skipPatterns = ['users', 'home', 'documents', 'desktop', 'downloads'];
    let candidateIndex = -1;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i].toLowerCase();
      if (!skipPatterns.includes(part) && part.length > 1) {
        // This could be a project name if it's not a common system directory
        candidateIndex = i;
        break;
      }
    }

    if (candidateIndex >= 0 && candidateIndex < parts.length - 1) {
      // Take the next part after the candidate (likely the project name)
      return parts[candidateIndex + 1];
    }

    // Last resort: if we have at least 3 parts, take the one that's most likely a project
    if (parts.length >= 3) {
      // Skip the first two parts (usually /Users/username) and take the third
      return parts[2] || '';
    }

    return '';
  }

  /**
   * Calculate relevance score for project-based filtering
   */
  private calculateProjectRelevanceScore(
    conversation: any,
    projectPath: string,
    options?: {
      filePattern?: string;
      exactFilePath?: string;
    }
  ): number {
    let score = 0;

    // NEW: Check context field for project paths (highest priority)
    const contextProjectPaths = this.extractProjectPathsFromContext(conversation);
    for (const contextPath of contextProjectPaths) {
      if (contextPath === projectPath) {
        score += 15; // Highest score for exact context match
      } else if (contextPath.includes(projectPath) || projectPath.includes(contextPath)) {
        score += 10; // High score for partial context match
      }
    }

    // Check attachedFoldersNew for exact matches and path prefixes
    if (conversation.attachedFoldersNew && Array.isArray(conversation.attachedFoldersNew)) {
      for (const folder of conversation.attachedFoldersNew) {
        if (typeof folder === 'string') {
          if (folder === projectPath) {
            score += 10; // Exact match
          } else if (folder.startsWith(projectPath + '/')) {
            score += 5; // Subfolder match
          } else if (projectPath.startsWith(folder + '/')) {
            score += 3; // Parent folder match
          }
        }
      }
    }

    // Check relevantFiles for matches
    if (conversation.relevantFiles && Array.isArray(conversation.relevantFiles)) {
      for (const file of conversation.relevantFiles) {
        if (typeof file === 'string') {
          if (options?.exactFilePath && file === options.exactFilePath) {
            score += 8; // Exact file match
          } else if (file.startsWith(projectPath + '/')) {
            score += 2; // File in project
          }

          // File pattern matching
          if (options?.filePattern) {
            const pattern = options.filePattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            const regex = new RegExp(pattern);
            if (regex.test(file)) {
              score += 1;
            }
          }
        }
      }
    }

    // Check legacy conversation messages for attachedFoldersNew and relevantFiles
    if (conversation.conversation && Array.isArray(conversation.conversation)) {
      for (const message of conversation.conversation) {
        if (message.attachedFoldersNew && Array.isArray(message.attachedFoldersNew)) {
          for (const folder of message.attachedFoldersNew) {
            if (typeof folder === 'string' && folder.startsWith(projectPath)) {
              score += 1;
            }
          }
        }
        if (message.relevantFiles && Array.isArray(message.relevantFiles)) {
          for (const file of message.relevantFiles) {
            if (typeof file === 'string' && file.startsWith(projectPath + '/')) {
              score += 1;
            }
          }
        }
      }
    }

    return Math.max(score, 1); // Minimum score of 1
  }

  /**
   * Get conversation by ID (handles both legacy and modern formats)
   */
  async getConversationById(composerId: string): Promise<CursorConversation | null> {
    this.ensureConnected();

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
        throw new ConversationParseError(`Failed to parse conversation data`, composerId, parseError instanceof Error ? parseError : new Error(String(parseError)));
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
    this.ensureConnected();

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
        throw new ConversationParseError(`Failed to parse bubble message data`, composerId, parseError instanceof Error ? parseError : new Error(String(parseError)));
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
    this.ensureConnected();

    const conversation = await this.getConversationById(composerId);
    if (!conversation) {
      return null;
    }

    const conversationSize = JSON.stringify(conversation).length;
    const modernConvo = conversation as ModernCursorConversation;

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

    const lastActivityTime = await this.getLastActivityTime(conversation)

    const summary: ConversationSummary = {
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
        total: conversation.todos.length
      },
      lastActivityTime: lastActivityTime.string,
      lastActivityTimeMsAgo: lastActivityTime.msAgo
    };

    return summary;
  }

  private async getLastActivityTime(conversation: CursorConversation): Promise<{ string: string, msAgo: number }> {
    // get last bubble and read time diff 
    const lastBubbleId = conversation.fullConversationHeadersOnly[conversation.fullConversationHeadersOnly.length - 1]?.bubbleId;
    const lastBubble = await this.getBubbleMessage(conversation.composerId, lastBubbleId);
    const lastBubbleTime = parseISO(lastBubble?.createdAt || '')
    return {
      string: formatDistanceToNow(lastBubbleTime),
      msAgo: Date.now() - lastBubbleTime.getTime()
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(): Promise<ConversationStats> {
    this.ensureConnected();

    const sql = `
      SELECT key, length(value) as size, value FROM cursorDiskKV
      WHERE key LIKE 'composerData:%'
      AND length(value) > ?
    `;

    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(this.config.minConversationSize || 5000) as Array<{
      key: string;
      size: number;
      value: string
    }>;

    let modernCount = 0;
    let totalSize = 0;
    let conversationsWithCode = 0;

    for (const row of rows) {
      totalSize += row.size;
      try {
        modernCount++;
      } catch (error) {
        console.error(`Failed to parse conversation during stats:`, error);
      }
    }

    const totalConversations = modernCount;
    const averageSize = totalConversations > 0 ? totalSize / totalConversations : 0;

    return {
      totalConversations,
      modernFormatCount: totalConversations,
      averageConversationSize: Math.round(averageSize),
      totalConversationsWithCode: conversationsWithCode,
      mostCommonFiles: [],
      mostCommonFolders: []
    };
  }

  /**
   * Detect conversation format (always modern now)
   */
  async detectConversationFormat(composerId: string): Promise<'modern' | null> {
    const conversation = await this.getConversationById(composerId);
    if (!conversation) return null;

    return 'modern';
  }

  /**
   * Get conversation summaries for analytics
   */
  async getConversationSummariesForAnalytics(
    conversationIds: string[],
    options?: { includeCodeBlocks?: boolean }
  ): Promise<ConversationSummary[]> {
    this.ensureConnected();

    const summaries: ConversationSummary[] = [];

    for (const composerId of conversationIds) {
      try {
        const summary = await this.getConversationSummary(composerId, {
          includeFirstMessage: true,
          includeCodeBlockCount: true,
          includeFileList: true,
          includeAttachedFolders: true,
          maxFirstMessageLength: 150
        });

        if (summary) {
          summaries.push(summary);
        }
      } catch (error) {
        console.error(`Failed to get summary for conversation ${composerId}:`, error);
      }
    }

    return summaries;
  }

  
}