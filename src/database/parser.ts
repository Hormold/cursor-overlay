import type {
  CursorConversation,
  ModernCursorConversation,
  BubbleMessage,
  CodeBlock
} from './types.js';
import {
  isModernConversation
} from './types.js';

export class ConversationParser {
  /**
   * Parse conversation JSON data
   */
  parseConversationJSON(rawData: string): CursorConversation {
    try {
      const parsed = JSON.parse(rawData);

      if (!this.isValidConversation(parsed)) {
        throw new Error('Invalid conversation format');
      }

      return parsed as CursorConversation;
    } catch (error) {
      throw new Error(`Failed to parse conversation JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate conversation structure
   */
  private isValidConversation(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (typeof data.composerId !== 'string') {
      return false;
    }

    // Only modern format now

    if (typeof data._v === 'number' && Array.isArray(data.fullConversationHeadersOnly)) {
      return this.isValidModernConversation(data);
    }

    return false;
  }


  /**
   * Validate modern conversation format
   */
  private isValidModernConversation(data: any): boolean {
    if (!Array.isArray(data.fullConversationHeadersOnly)) {
      return false;
    }

    for (const header of data.fullConversationHeadersOnly) {
      if (!this.isValidConversationHeader(header)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate message structure
   */
  private isValidMessage(message: any): boolean {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'number' &&
      typeof message.bubbleId === 'string' &&
      typeof message.text === 'string'
    );
  }

  /**
   * Validate conversation header structure
   */
  private isValidConversationHeader(header: any): boolean {
    return (
      header &&
      typeof header === 'object' &&
      typeof header.type === 'number' &&
      typeof header.bubbleId === 'string'
    );
  }


  /**
   * Get conversation metadata
   */
  getConversationMetadata(conversation: CursorConversation): {
    messageCount: number;
    hasCodeBlocks: boolean;
    codeBlockCount: number;
    fileCount: number;
    folderCount: number;
    hasStoredSummary: boolean;
    size: number;
  } {
    const format = 'modern';
    const size = JSON.stringify(conversation).length;

    let messageCount = 0;
    let codeBlockCount = 0;
    let fileCount = 0;
    let folderCount = 0;

    
    messageCount = conversation.fullConversationHeadersOnly.length;
    const hasCodeBlocks = codeBlockCount > 0;
    const hasStoredSummary = !!(conversation.text || conversation.richText || (conversation as any).storedSummary);

    return {
      messageCount,
      hasCodeBlocks,
      codeBlockCount,
      fileCount,
      folderCount,
      hasStoredSummary,
      size
    };
  }
  /**
   * Check if conversation contains summarization content
   */
  containsSummarization(conversation: CursorConversation): boolean {
    const summarizationKeywords = ['summarization', 'summarize', 'summary'];

    // Also check stored summary fields
    const text = conversation.text?.toLowerCase() || '';
    const richText = conversation.richText?.toLowerCase() || '';

    return summarizationKeywords.some(keyword =>
      text.includes(keyword) || richText.includes(keyword)
    );
  }

  /**
   * Parse bubble message JSON
   */
  parseBubbleMessage(rawData: string): BubbleMessage {
    try {
      const parsed = JSON.parse(rawData);

      if (!this.isValidBubbleMessage(parsed)) {
        throw new Error('Invalid bubble message format');
      }

      return parsed as BubbleMessage;
    } catch (error) {
      throw new Error(`Failed to parse bubble message JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate bubble message structure
   */
  private isValidBubbleMessage(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.type === 'number' &&
      typeof data.text === 'string'
    );
    }
}