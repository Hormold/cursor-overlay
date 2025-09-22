import Database from 'better-sqlite3';
import { formatDistanceToNow } from 'date-fns';

export interface ClaudeMessage {
  uuid: string;
  parent_uuid: string | null;
  session_id: string;
  timestamp: number;
  message_type: string;
  cwd: string;
  user_type: string;
  version: string;
  isSidechain: number;
}

export interface ClaudeUserMessage extends ClaudeMessage {
  message: string;
  tool_use_result: string | null;
}

export interface ClaudeAssistantMessage extends ClaudeMessage {
  content: string;
  content_blocks: string | null;
  usage: string | null;
}

export interface ClaudeConversationSummary {
  leaf_uuid: string;
  summary: string;
  updated_at: number;
}

export interface ClaudeConversation {
  session_id: string;
  title: string;
  messageCount: number;
  firstMessage?: string;
  lastMessage?: string;
  summary?: string;
  lastActivityTime: string;
  lastActivityTimeMsAgo: number;
  cwd: string;
  version: string;
}

export interface ClaudeReaderConfig {
  dbPath: string;
  maxConversations?: number;
  cacheEnabled?: boolean;
}

export class ClaudeCodeDatabaseReader {
  private db: Database.Database | null = null;
  private config: ClaudeReaderConfig;
  private cache: Map<string, unknown> = new Map();

  constructor(config: ClaudeReaderConfig) {
    this.config = {
      maxConversations: 50,
      cacheEnabled: true,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      this.db = new Database(this.config.dbPath, { readonly: true });
      
      // Test connection
      const testQuery = this.db.prepare('SELECT COUNT(*) as count FROM base_messages LIMIT 1');
      testQuery.get();
    } catch (error) {
      throw new Error(`Failed to connect to Claude database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }

  /**
   * Get all session IDs ordered by most recent activity
   */
  async getSessionIds(): Promise<string[]> {
    this.ensureConnected();

    const sql = `
      SELECT DISTINCT session_id 
      FROM base_messages 
      ORDER BY MAX(timestamp) DESC
      LIMIT ?
    `;
    
    if (!this.db) {
      throw new Error('Database not connected');
    }
    
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(this.config.maxConversations || 50) as Array<{ session_id: string }>;
    
    return rows.map(row => row.session_id);
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(sessionId: string): Promise<{
    userMessages: ClaudeUserMessage[];
    assistantMessages: ClaudeAssistantMessage[];
  }> {
    this.ensureConnected();
    
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const cacheKey = `session:${sessionId}`;
    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as { userMessages: ClaudeUserMessage[]; assistantMessages: ClaudeAssistantMessage[]; };
    }

    // Get user messages
    const userSql = `
      SELECT bm.*, um.message, um.tool_use_result 
      FROM base_messages bm 
      JOIN user_messages um ON bm.uuid = um.uuid 
      WHERE bm.session_id = ? 
      ORDER BY bm.timestamp ASC
    `;
    
    const userStmt = this.db.prepare(userSql);
    const userMessages = userStmt.all(sessionId) as ClaudeUserMessage[];

    // Get assistant messages  
    const assistantSql = `
      SELECT bm.*, am.content, am.content_blocks, am.usage 
      FROM base_messages bm 
      JOIN assistant_messages am ON bm.uuid = am.uuid 
      WHERE bm.session_id = ? 
      ORDER BY bm.timestamp ASC
    `;
    
    const assistantStmt = this.db.prepare(assistantSql);
    const assistantMessages = assistantStmt.all(sessionId) as ClaudeAssistantMessage[];

    const result = { userMessages, assistantMessages };
    
    if (this.config.cacheEnabled) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Get conversation summary for a session
   */
  async getConversationSummary(sessionId: string): Promise<ClaudeConversation | null> {
    this.ensureConnected();

    const { userMessages, assistantMessages } = await this.getSessionMessages(sessionId);
    
    if (userMessages.length === 0 && assistantMessages.length === 0) {
      return null;
    }

    const allMessages = [...userMessages, ...assistantMessages].sort((a, b) => a.timestamp - b.timestamp);
    
    const firstMessage = userMessages[0];
    const lastMessage = allMessages[allMessages.length - 1];
    
    // Try to get stored summary
    let summary: string | undefined;
    if (lastMessage && this.db) {
      const summaryQuery = this.db.prepare('SELECT summary FROM conversation_summaries WHERE leaf_uuid = ?');
      const summaryRow = summaryQuery.get(lastMessage.uuid) as ClaudeConversationSummary | undefined;
      summary = summaryRow?.summary;
    }

    // Generate title from first user message
    let title = 'Claude Conversation';
    if (firstMessage?.message) {
      try {
        const messageObj = JSON.parse(firstMessage.message) as Record<string, unknown>;
        if (messageObj.content) {
          const content = Array.isArray(messageObj.content) 
            ? messageObj.content.find((c: Record<string, unknown>) => c.type === 'text')?.text as string || messageObj.content[0]?.content as string || ''
            : messageObj.content as string;
          title = content.substring(0, 50).trim() + (content.length > 50 ? '...' : '');
        }
      } catch {
        // Fallback to raw message
        title = firstMessage.message.substring(0, 50).trim() + (firstMessage.message.length > 50 ? '...' : '');
      }
    }

    const lastActivityTime = new Date(lastMessage.timestamp);
    
    return {
      session_id: sessionId,
      title,
      messageCount: allMessages.length,
      firstMessage: this.extractMessageText(firstMessage),
      lastMessage: this.extractMessageText(lastMessage),
      summary,
      lastActivityTime: `${formatDistanceToNow(lastActivityTime)} ago`,
      lastActivityTimeMsAgo: Date.now() - lastActivityTime.getTime(),
      cwd: firstMessage?.cwd || 'unknown',
      version: firstMessage?.version || 'unknown',
    };
  }

  /**
   * Get recent conversations with summaries
   */
  async getRecentConversations(limit: number = 20): Promise<ClaudeConversation[]> {
    const sessionIds = await this.getSessionIds();
    const limitedSessionIds = sessionIds.slice(0, limit);
    
    const conversations: ClaudeConversation[] = [];
    
    for (const sessionId of limitedSessionIds) {
      const conversation = await this.getConversationSummary(sessionId);
      if (conversation) {
        conversations.push(conversation);
      }
    }
    
    return conversations;
  }

  private extractMessageText(message: ClaudeUserMessage | ClaudeAssistantMessage | null): string | undefined {
    if (!message) return undefined;
    
    try {
      if ('message' in message) {
        // User message
        const messageObj = JSON.parse(message.message);
        if (messageObj.content) {
          const content = Array.isArray(messageObj.content) 
            ? messageObj.content.find((c: Record<string, unknown>) => c.type === 'text')?.text as string || messageObj.content[0]?.content as string || ''
            : messageObj.content;
          return content.substring(0, 200).trim();
        }
      } else if ('content' in message) {
        // Assistant message
        return message.content.substring(0, 200).trim();
      }
    } catch {
      // Fallback to raw content
      if ('message' in message) {
        return message.message.substring(0, 200).trim();
      } else if ('content' in message) {
        return message.content.substring(0, 200).trim();
      }
    }
    
    return undefined;
  }
}