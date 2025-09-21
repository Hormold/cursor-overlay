// Type definitions for Cursor chat data
// Supports modern conversation format

export interface CursorDiskKV {
  key: string;
  value: string;
}

// Key patterns in the Cursor database
export type CursorKeyPatterns = {
  composerData: `composerData:${string}`;
  bubbleId: `bubbleId:${string}:${string}`;
  messageRequestContext: `messageRequestContext:${string}:${string}`;
  checkpointId: `checkpointId:${string}`;
  codeBlockDiff: `codeBlockDiff:${string}`;
};


// Modern format conversation structure
export interface ModernCursorConversation {
  _v: number;                          // Version field (e.g., 10)
  composerId: string;
  richText: string;                    // JSON string with formatting
  hasLoaded: boolean;
  text: string;                        // May contain conversation summary (often empty)
  fullConversationHeadersOnly: ConversationHeader[];
  conversationMap: Record<string, any>; // Empty object in current examples
  status: 'completed' | 'active' | 'pending'; // Conversation status
  context: {
    notepads: any[];
    composers: any[];
    quotes: any[];
    selectedCommits: any[];
    selectedPullRequests: any[];
    selectedImages: any[];
    folderSelections: any[];
    fileSelections: any[];
    selections: any[];
    terminalSelections: any[];
    selectedDocs: any[];
    externalLinks: any[];
    cursorRules: any[];
    cursorCommands: any[];
    uiElementSelections: any[];
    mentions: {
      notepads: Record<string, any>;
      composers: Record<string, any>;
      quotes: Record<string, any>;
      selectedCommits: Record<string, any>;
      selectedPullRequests: Record<string, any>;
      gitDiff: any[];
      gitDiffFromBranchToMain: any[];
      selectedImages: Record<string, any>;
      useWeb: any[];
      folderSelections: Record<string, any>;
      fileSelections: Record<string, any>;
      terminalFiles: Record<string, any>;
      selections: Record<string, any>;
      terminalSelections: Record<string, any>;
      selectedDocs: Record<string, any>;
      externalLinks: Record<string, any>;
      useLinterErrors: any[];
      useDiffReview: any[];
      useGenerateRules: any[];
      useContextPicking: any[];
      useRememberThis: any[];
      diffHistory: any[];
      cursorRules: Record<string, any>;
      cursorCommands: Record<string, any>;
      autoContext: any[];
      uiElementSelections: Record<string, any>;
      ideEditorsState: any[];
    };
  };
  gitGraphFileSuggestions: any[];
  generatingBubbleIds: any[];
  isReadingLongFile: boolean;
  codeBlockData: Record<string, Record<string, any>>; // File paths -> bubble IDs -> code block data
  originalFileStates: Record<string, {
    content: string;
    firstEditBubbleId: string;
    isNewlyCreated: boolean;
    newlyCreatedFolders: any[];
  }>;
  newlyCreatedFiles: Array<{
    uri: {
      fsPath: string;
      path: string;
    };
  }>;
  newlyCreatedFolders: any[];
  lastUpdatedAt: number;
  createdAt: number;
  hasChangedContext: boolean;
  activeTabsShouldBeReactive: boolean;
  capabilities: Array<{
    type: number;
    data: Record<string, any>;
  }>;
  name: string;                        // Conversation title
  isFileListExpanded: boolean;
  unifiedMode: string;                 // e.g., 'agent'
  forceMode: string;                   // e.g., 'edit'
  usageData: Record<string, any>;
  contextUsagePercent: number;
  contextTokensUsed: number;
  contextTokenLimit: number;
  allAttachedFileCodeChunksUris: string[];
  modelConfig: {
    modelName: string;
    maxMode: boolean;
  };
  subComposerIds: string[];
  capabilityContexts: any[];
  todos: Array<{
    content: string;
    status: 'completed' | 'active' | 'pending';
    id: string;
    dependencies: string[];
  }>;
  isTodoListExpanded: boolean;
  isQueueExpanded: boolean;
  hasUnreadMessages: boolean;
  gitHubPromptDismissed: boolean;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  isArchived: boolean;
  latestChatGenerationUUID: string;
  isAgentic: boolean;
  subtitle: string;
  hasBlockingPendingActions: boolean;
}

// Union type for both conversation formats (only modern now)
export type CursorConversation = ModernCursorConversation;

// Header structure for modern format
export interface ConversationHeader {
  bubbleId: string;
  type: number;                        // 1 = user, 2 = AI
  serverBubbleId?: string;             // For AI responses
}


// Individual message for modern format (stored separately)
export interface BubbleMessage {
  _v: number
  type: number
  approximateLintErrors: string[]
  lints: string[]
  codebaseContextChunks: string[]
  commits: string[]
  pullRequests: string[]
  attachedCodeChunks: string[]
  assistantSuggestedDiffs: string[]
  gitDiffs: string[]
  interpreterResults: string[]
  images: string[]
  attachedFolders: string[]
  attachedFoldersNew: string[]
  bubbleId: string
  userResponsesToSuggestedCodeBlocks: string[]
  suggestedCodeBlocks: string[]
  diffsForCompressingFiles: string[]
  relevantFiles: string[]
  toolResults: string[]
  notepads: string[]
  capabilities: string[]
  capabilityStatuses: Record<
    | "mutate-request"
    | "start-submit-chat"
    | "before-submit-chat"
    | "chat-stream-finished"
    | "before-apply"
    | "after-apply"
    | "accept-all-edits"
    | "composer-done"
    | "process-stream"
    | "add-pending-action",
    string[]
  >
  multiFileLinterErrors: string[]
  diffHistories: string[]
  recentLocationsHistory: string[]
  recentlyViewedFiles: string[]
  isAgentic: boolean
  fileDiffTrajectories: string[]
  existedSubsequentTerminalCommand: boolean
  existedPreviousTerminalCommand: boolean
  docsReferences: string[]
  webReferences: string[]
  aiWebSearchResults: string[]
  requestId: string
  attachedFoldersListDirResults: string[]
  humanChanges: string[]
  attachedHumanChanges: boolean
  summarizedComposers: string[]
  cursorRules: string[]
  contextPieces: string[]
  editTrailContexts: string[]
  allThinkingBlocks: string[]
  diffsSinceLastApply: string[]
  deletedFiles: string[]
  supportedTools: string[]
  tokenCount: {
    inputTokens: number
    outputTokens: number
  }
  attachedFileCodeChunksMetadataOnly: string[]
  consoleLogs: string[]
  uiElementPicked: string[]
  isRefunded: boolean
  knowledgeItems: string[]
  documentationSelections: string[]
  externalLinks: string[]
  useWeb: boolean
  projectLayouts: string[]
  unifiedMode: number
  capabilityContexts: string[]
  todos: string[]
  createdAt: string
  text: string
  usageUuid: string
  codeBlocks: {
    unregistered: boolean
    content: string
    languageId: string
    isGenerating: boolean
    isClickable: boolean
    codeBlockIdx: number
  }[]
  symbolLinks: {
    symbolName: string
    symbolSearchString: string
    relativeWorkspacePath: string
    roughLineNumber: number
  }[]
}

// Code block structure
export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

// Conversation summary data
export interface ConversationSummary {
  composerId: string;
  messageCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  relevantFiles: string[];
  attachedFolders: string[];
  firstMessage?: string;               // Truncated first user message
  lastMessage?: string;                // Last message in conversation
  storedSummary?: string;              // From text field if available
  storedRichText?: string;             // From richText field if available
  title?: string;                      // From 'name' field (Modern format only)
  aiGeneratedSummary?: string;         // From 'latestConversationSummary.summary.summary'
  conversationSize: number;            // Size in bytes
  linesAdded: number;                  // Real lines of code added
  linesRemoved: number;                // Real lines of code removed/modified
  todos: {
    completed: number;
    total: number;
  }
  lastActivityTime: string;
  lastActivityTimeMsAgo: number;
}

// Search result structure
export interface ConversationSearchResult {
  composerId: string;
  format: 'modern';
  matches: SearchMatch[];
  relevantFiles: string[];
  attachedFolders: string[];
  maxLastMessageLength?: number;             // Max length for last message
  includeStoredSummary?: boolean;            // Include text/richText fields
  includeFileList?: boolean;                 // Include relevant files
  includeCodeBlockCount?: boolean;           // Count code blocks
  includeAttachedFolders?: boolean;          // Include attached folders
  includeMetadata?: boolean;                 // Include metadata information
  includeTitle?: boolean;                    // Include conversation title (Modern format)
  includeAIGeneratedSummary?: boolean;       // Include AI-generated summary (Modern format)
}

export interface SearchMatch {
  messageIndex?: number;               // For modern format
  bubbleId?: string;                   // For modern format
  text: string;
  context: string;                     // Surrounding text
  type: number;                        // 1 = user, 2 = AI
}

// Statistics structure
export interface ConversationStats {
  totalConversations: number;
  modernFormatCount: number;
  averageConversationSize: number;
  totalConversationsWithCode: number;
  mostCommonFiles: Array<{ file: string; count: number }>;
  mostCommonFolders: Array<{ folder: string; count: number }>;
}

// Filter options for conversation queries
export interface ConversationFilters {
  dateRange?: { start: Date; end: Date };    // ⚠️ Limited - no reliable timestamps
  minLength?: number;                        // Filter by conversation size
  keywords?: string[];                       // Search in conversation content
  projectPath?: string;                      // Filter by attached folders
  relevantFiles?: string[];                  // Filter by specific files mentioned
  filePattern?: string;                      // Filter by file pattern (e.g., "*.tsx")
  hasCodeBlocks?: boolean;                   // Filter conversations with code
  format?: 'modern';    // Filter by conversation format (modern only)
}

// Summary options
export interface SummaryOptions {
  includeFirstMessage?: boolean;             // Include truncated first message
  includeLastMessage?: boolean;              // Include last message
  maxFirstMessageLength?: number;            // Max length for first message
  maxLastMessageLength?: number;             // Max length for last message
  includeStoredSummary?: boolean;            // Include text/richText fields
  includeFileList?: boolean;                 // Include relevant files
  includeCodeBlockCount?: boolean;           // Count code blocks
  includeAttachedFolders?: boolean;          // Include attached folders
  includeMetadata?: boolean;                 // Include metadata information
  includeTitle?: boolean;                    // Include conversation title (Modern format)
  includeAIGeneratedSummary?: boolean;       // Include AI-generated summary (Modern format)
}

// Database configuration
export interface DatabaseConfig {
  dbPath: string;
  maxConversations?: number;                 // Limit for performance
  cacheEnabled?: boolean;                    // Cache frequently accessed data
  minConversationSize?: number;              // Minimum size to consider valid
  resolveBubblesAutomatically?: boolean;     // Auto-resolve bubble messages
}

// Platform-specific database paths
export interface CursorDatabasePaths {
  macOS: string;
  windows: string;
  linux: string;
}

// Type guard for modern conversation format
export function isModernConversation(conversation: any): conversation is ModernCursorConversation {
  return conversation &&
         typeof conversation.composerId === 'string' &&
         typeof conversation._v === 'number' &&
         Array.isArray(conversation.fullConversationHeadersOnly);
}

// New types for analytics tools

export interface ConversationAnalytics {
  overview: {
    totalConversations: number;
    totalMessages: number;
    totalCodeBlocks: number;
    averageConversationSize: number;
    averageMessagesPerConversation: number;
    totalFiles: number;
    totalFolders: number;
  };
  breakdowns: {
    files?: Array<{
      file: string;
      mentions: number;
      conversations: string[];
      extension: string;
      projectPath?: string;
    }>;
    languages?: Array<{
      language: string;
      codeBlocks: number;
      conversations: string[];
      averageCodeLength: number;
    }>;
    temporal?: Array<{
      period: string;
      conversationCount: number;
      messageCount: number;
      averageSize: number;
      conversationIds: string[];
    }>;
    size?: {
      distribution: number[];
      percentiles: Record<string, number>;
      bins: Array<{ range: string; count: number }>;
    };
  };
  scope: {
    type: string;
    projectPath?: string;
    recentDays?: number;
    totalScanned: number;
  };
  // Include conversation IDs for follow-up analysis
  conversationIds: string[];
  // Include basic conversation info for immediate access
  conversations: Array<{
    composerId: string;
    messageCount: number;
    size: number;
    files: string[];
    hasCodeBlocks: boolean;
  }>;
}

export interface RelatedConversationsResult {
  reference: {
    composerId: string;
    files: string[];
    folders: string[];
    languages: string[];
    messageCount: number;
    size: number;
  };
  related: Array<{
    composerId: string;
    relationshipScore: number;
    relationships: {
      sharedFiles?: string[];
      sharedFolders?: string[];
      sharedLanguages?: string[];
      sizeSimilarity?: number;
      temporalProximity?: number;
    };
    summary: string;
    scoreBreakdown?: Record<string, number>;
  }>;
}

export interface ExtractedElements {
  conversations: Array<{
    composerId: string;
    format: 'modern';
    elements: {
      files?: Array<{
        path: string;
        extension: string;
        context?: string;
        messageType: 'user' | 'assistant';
      }>;
      folders?: Array<{
        path: string;
        context?: string;
      }>;
      languages?: Array<{
        language: string;
        codeBlocks: number;
        totalLines: number;
        averageLength: number;
      }>;
      codeblocks?: Array<{
        language: string;
        code: string;
        filename?: string;
        lineCount: number;
        messageType: 'user' | 'assistant';
        context?: string;
      }>;
      metadata?: {
        messageCount: number;
        size: number;
        format: 'modern';
        userMessages: number;
        assistantMessages: number;
        hasCodeBlocks: boolean;
        hasFileReferences: boolean;
      };
      structure?: {
        messageFlow: Array<{ type: 'user' | 'assistant'; length: number; hasCode: boolean }>;
        conversationPattern: string;
        averageMessageLength: number;
        longestMessage: number;
      };
    };
  }>;
}

export interface ExportedData {
  format: string;
  data: any;
  metadata: {
    exportedCount: number;
    totalAvailable: number;
    exportTimestamp: string;
    filters: Record<string, any>;
  };
}

// UI specific types for the overlay
export interface ConversationTask {
  composerId: string;
  title: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
  messageCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  relevantFiles: string[];
  isOngoing: boolean;
  linesAdded: number;
  linesRemoved: number;
  todos: {
    completed: number;
    total: number;
  }
  lastActivityTime: string;
}

export interface OverlayState {
  tasks: ConversationTask[];
  totalCompleted: number;
  totalActive: number;
  totalFiles: number;
  isLoading: boolean;
  error: string | null;
}