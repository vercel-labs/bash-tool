# CLAUDE.md

This file provides guidance for Claude Code when working on this project.

## Project Overview

`bash-tool` is a generic bash tool for AI agents, compatible with AI SDK (https://ai-sdk.dev/). It provides bash, readFile, and writeFile tools that work with a sandboxed environment.

## Commands

```bash
pnpm build          # Compile TypeScript to dist/
pnpm typecheck      # Type check without emitting
pnpm test           # Run tests in watch mode
pnpm test:run       # Run tests once
pnpm lint           # Check with Biome
pnpm lint:fix       # Fix lint issues
pnpm knip           # Check for unused exports/dependencies
pnpm validate       # Run all checks (lint, knip, typecheck, test)
```

## Architecture

### Entry Point
- `src/index.ts` - Public exports only (`createBashTool` and types)
- `src/tool.ts` - Main `createBashTool()` function that orchestrates everything

### Core Interfaces (`src/types.ts`)
- `Sandbox` - Abstract interface for sandbox implementations (executeCommand, readFile, writeFile, stop)
- `CreateBashToolOptions` - Configuration for createBashTool
- `BashToolkit` - Return type with tools and sandbox instance

### Sandbox Adapters (`src/sandbox/`)
- `just-bash.ts` - Default adapter using just-bash (optional peer dependency)
- `vercel.ts` - Adapter wrapping @vercel/sandbox instances

### Tools (`src/tools/`)
- `bash.ts` - Execute bash commands with contextual LLM instructions
- `read-file.ts` - Read file contents
- `write-file.ts` - Write files

### File Loading (`src/files/`)
- `loader.ts` - Loads files from inline content or disk directories

## Key Design Decisions

1. **Optional peer dependencies**: just-bash and @vercel/sandbox are optional. Dynamic imports with helpful error messages when not installed.

2. **Destination directory**: All files go to `destination` (default: `/workspace`). This is also the working directory for commands.

3. **Contextual instructions**: The bash tool generates LLM instructions that include the working directory and list of available files.

4. **Sandbox auto-detection**: The `sandbox` parameter auto-detects both `@vercel/sandbox` instances (checks for `shells` and `kill`) and just-bash `Bash` instances (checks for `exec` method). Users can also provide a custom `Sandbox` implementation.

## Testing

Tests are co-located with source files (`*.test.ts`). Tests are included in TypeScript compilation for type checking.

- Unit tests mock just-bash
- Integration tests (`tool.integration.test.ts`) use real just-bash

AI SDK tool execute calls require `ToolExecutionOptions` with `toolCallId` and `messages`.
