# Cursor & Claude Code Overlay

Transparent floating overlay that displays active AI sessions from both Cursor and Claude Code in real-time. 
On top of all other windows.
It works, but it is not perfect and only tested on macOS. Contributions are welcome.

![Cursor Overlay](./assets/demo.png)

## TODO
- [X] Solve problem with clicking on the overlay
- [X] Hide button to right top corner of the overlay
- [X] Fix hide/show sections by clicking 
- [X] Fix blacklisting for session (to hide agents from view)
- [X] Display current (in-progress) task in the overlay
- [X] Claude Code Support

## What it does

- Shows active/completed/pending sessions from **Cursor** and **Claude Code** in unified floating window
- **Cursor integration**: Reads SQLite database for AI agent conversations
- **Claude Code integration**: Parses JSONL session files with todo extraction
- Auto-updates when Cursor database changes
- Displays session status (active/waiting vs completed)
- Shows todo progress from Claude Code sessions
- Blacklist unwanted sessions from view


## Quick Start (How to run it locally)

```bash
pnpm install && pnpm run dev
```

## Commands

```bash
pnpm run dev          # Dev mode with hot reload
pnpm run build        # Build TypeScript
pnpm run start        # Run production build
pnpm run lint         # Check code quality
pnpm run lint:fix     # Fix linting issues
```

## Stack

- Electron + TypeScript
- Preact (React compat)
- SQLite (reads Cursor's database)
- JSONL parser (reads Claude Code sessions)
- TailwindCSS

## Structure

```
src/
├── main.ts              # Electron main process
├── renderer/            # UI components (Preact)
├── database/            # Data readers
│   ├── reader.ts        # Cursor SQLite database reader
│   └── claude-jsonl-reader.ts  # Claude Code JSONL parser
└── utils/               # Helpers
```

## Data Sources

### Cursor Integration
Reads Cursor's SQLite database to extract AI agent conversations, code changes, and session metadata.
Based on [cursor-chat-history-mcp](https://github.com/vltansky/cursor-chat-history-mcp) - thanks for the database reverse engineering!

### Claude Code Integration
Parses Claude Code's JSONL session files from `~/.claude/projects/*/` to extract:
- Session conversations and summaries
- TodoWrite task progress and status
- Code file modifications and tool usage
- Session state detection (active vs completed)
