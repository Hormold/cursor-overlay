export interface ModernCursorConversation {
  _v: number;                          // Version field (e.g., 10)
  composerId: string;
  richText: string;                    // JSON string with formatting
  hasLoaded: boolean;
  text: string;                        // May contain conversation summary (often empty)
  fullConversationHeadersOnly: ConversationHeader[];
  conversationMap: Record<string, unknown>; // Empty object in current examples
  status: 'completed' | 'active' | 'pending'; // Conversation status
  context: {
    // Most of types are empty objects in current examples
    notepads: unknown[];
    composers: unknown[];
    quotes: unknown[];
    selectedCommits: unknown[];
    selectedPullRequests: unknown[];
    selectedImages: unknown[];
    folderSelections: unknown[];
    fileSelections: unknown[];
    selections: unknown[];
    terminalSelections: unknown[];
    selectedDocs: unknown[];
    externalLinks: unknown[];
    cursorRules: unknown[];
    cursorCommands: unknown[];
    uiElementSelections: unknown[];
    mentions: {
      notepads: Record<string, unknown>;
      composers: Record<string, unknown>;
      quotes: Record<string, unknown>;
      selectedCommits: Record<string, unknown>;
      selectedPullRequests: Record<string, unknown>;
      gitDiff: unknown[];
      gitDiffFromBranchToMain: unknown[];
      selectedImages: Record<string, unknown>;
      useWeb: unknown[];
      folderSelections: Record<string, unknown>;
      fileSelections: Record<string, unknown>;
      terminalFiles: Record<string, unknown>;
      selections: Record<string, unknown>;
      terminalSelections: Record<string, unknown>;
      selectedDocs: Record<string, unknown>;
      externalLinks: Record<string, unknown>;
      useLinterErrors: unknown[];
      useDiffReview: unknown[];
      useGenerateRules: unknown[];
      useContextPicking: unknown[];
      useRememberThis: unknown[];
      diffHistory: unknown[];
      cursorRules: Record<string, unknown>;
      cursorCommands: Record<string, unknown>;
      autoContext: unknown[];
      uiElementSelections: Record<string, unknown>;
      ideEditorsState: unknown[];
    };
  };
  gitGraphFileSuggestions: unknown[];
  generatingBubbleIds: unknown[];
  isReadingLongFile: boolean;
  codeBlockData: Record<string, Record<string, unknown>>; // File paths -> bubble IDs -> code block data
  originalFileStates: Record<string, {
    content: string;
    firstEditBubbleId: string;
    isNewlyCreated: boolean;
    newlyCreatedFolders: unknown[];
  }>;
  newlyCreatedFiles: Array<{
    uri: {
      fsPath: string;
      path: string;
    };
  }>;
  newlyCreatedFolders: unknown[];
  lastUpdatedAt: number;
  createdAt: number;
  hasChangedContext: boolean;
  activeTabsShouldBeReactive: boolean;
  capabilities: Array<{
    type: number;
    data: Record<string, unknown>;
  }>;
  name: string;                        // Conversation title
  isFileListExpanded: boolean;
  unifiedMode: string;                 // e.g., 'agent'
  forceMode: string;                   // e.g., 'edit'
  usageData: Record<string, unknown>;
  contextUsagePercent: number;
  contextTokensUsed: number;
  contextTokenLimit: number;
  allAttachedFileCodeChunksUris: string[];
  modelConfig: {
    modelName: string;
    maxMode: boolean;
  };
  subComposerIds: string[];
  capabilityContexts: unknown[];
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
    | 'mutate-request'
    | 'start-submit-chat'
    | 'before-submit-chat'
    | 'chat-stream-finished'
    | 'before-apply'
    | 'after-apply'
    | 'accept-all-edits'
    | 'composer-done'
    | 'process-stream'
    | 'add-pending-action',
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
  projectName: string;
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
    firstInProgress: string | undefined;
  }
  lastActivityTime: string;
  lastActivityTimeMsAgo: number;
  model: string;
  hasBlockingPendingActions: boolean;
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

// UI specific types for the overlay
export interface ConversationTask {
  composerId: string;
  title: string;
  description: string;
  projectName: string;
  status: 'completed' | 'active' | 'pending';
  messageCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  relevantFiles: string[];
  linesAdded: number;
  linesRemoved: number;
  todos: {
    completed: number;
    total: number;
    firstInProgress: string | undefined;
  }
  lastActivityTime: string;
  hasBlockingPendingActions: boolean;
  modelName: string;
}

export interface OverlayState {
  tasks: ConversationTask[];
  totalCompleted: number;
  totalActive: number;
  totalFiles: number;
  isLoading: boolean;
  error: string | null;
}