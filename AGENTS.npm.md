<!--
This file is distributed as dist/AGENTS.md in the npm package.
It provides instructions for AI agents using bash-tool in their projects.
The build process copies this file to dist/AGENTS.md (removing this comment).
-->

# AGENTS.md - bash-tool

Instructions for AI agents using bash-tool in projects.

## What is bash-tool?

- Provides `bash`, `readFile`, `writeFile` tools for AI SDK agents
- Runs commands in sandboxed environments (just-bash or @vercel/sandbox)
- Pre-populates sandbox with files from inline content or disk
- Generates contextual LLM instructions with working directory and file list

## Quick Reference

```typescript
import { createBashTool } from "bash-tool";
import { generateText } from "ai";

const { bash, tools, sandbox } = await createBashTool({
  files: {
    "src/index.ts": "export const x = 1;",
    "package.json": '{"name": "test"}',
  },
});

const result = await generateText({
  model,
  tools: { bash }, // or use `tools` for all three
  prompt: "List files in src/",
});
```

## Key Behaviors

1. **Default sandbox is just-bash** - Install `just-bash` or provide your own sandbox
2. **Working directory defaults to `/workspace`** - All files written relative to `destination`
3. **Files are written before tools are returned** - Sandbox is pre-populated
4. **Tool descriptions include file list** - LLM sees available files in bash tool description
5. **No `stop()` method** - Sandbox lifecycle is managed externally

## Common Patterns

### Upload local directory

```typescript
const { bash } = await createBashTool({
  uploadDirectory: { source: "./my-project", include: "**/*.ts" },
});
```

### Use [@vercel/sandbox](https://vercel.com/docs/vercel-sandbox) for full VM

```typescript
import { Sandbox } from "@vercel/sandbox";
const vm = await Sandbox.create();
const { tools } = await createBashTool({ sandbox: vm });
// Call vm.stop() when done
```

### Persistent sandbox across serverless invocations

```typescript
import { Sandbox } from "@vercel/sandbox";

// First invocation: create and store sandboxId
const sandbox = await Sandbox.create();
const sandboxId = sandbox.sandboxId; // store this

// Later invocations: reconnect by ID
const sandbox = await Sandbox.get({ sandboxId });
const { tools } = await createBashTool({ sandbox });
// Previous files and state preserved
```

### Track tool invocations

```typescript
const { tools } = await createBashTool({
  onCall: (toolName, args) => console.log(toolName, args),
});
```

### Custom destination

```typescript
const { bash } = await createBashTool({
  destination: "/home/user/app",
  files: { "main.ts": "console.log('hi');" },
});
// Files at /home/user/app/main.ts, cwd is /home/user/app
```

## Limitations

- **just-bash is simulated** - Cannot support python, node.js or binaries; use @vercel/sandbox for a full VM. So, createBashTool supports full VMs, it is just the default that does not
- **No persistent state between calls** - Each `createBashTool` starts fresh, but the tool itself has persistence and it can be achieved across serverless function invocations by passing in the same sandbox across `createBashTool` invocations
- **Text files only** - `files` option accepts strings, not buffers
- **No streaming** - Command output returned after completion

## Error Handling

```typescript
const result = await tools.bash.execute({ command: "ls /nonexistent" }, opts);
if (result.exitCode !== 0) {
  console.error("Command failed:", result.stderr);
}

// readFile throws on missing files
try {
  await sandbox.readFile("/missing.txt");
} catch (e) {
  // "File not found: /missing.txt" or "Failed to read file: ..."
}
```

## Debugging Tips

1. **Check sandbox type** - `isVercelSandbox()` and `isJustBash()` exported for detection
2. **Inspect tool description** - `bash.description` shows working dir and file list
3. **Use `pwd` first** - Verify working directory matches expectations
4. **Check `exitCode`** - Non-zero means command failed, check `stderr`
5. **Missing just-bash error** - Install it or provide custom sandbox

## Discovering Types

TypeScript types are available in the `.d.ts` files:

```bash
# View main exports
cat node_modules/bash-tool/dist/index.d.ts

# View all options and types
cat node_modules/bash-tool/dist/types.d.ts

# Search for interfaces
grep -r "^export interface" node_modules/bash-tool/dist/*.d.ts
```

Key types to explore:

- `CreateBashToolOptions` - Options for createBashTool()
- `BashToolkit` - Return type with bash, tools, sandbox
- `Sandbox` - Interface for custom sandbox implementations
- `CommandResult` - Shape of executeCommand results
