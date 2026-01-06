# bash-tool

Generic bash tool for AI agents, compatible with [AI SDK](https://ai-sdk.dev/).

## Installation

```bash
npm install bash-tool just-bash
```

For full VM support, install `@vercel/sandbox` or another sandbox product instead of `just-bash`.

## Usage

```typescript
import { createBashTool } from "bash-tool";
import { generateText } from "ai";

const { bash, tools } = await createBashTool({
  files: {
    "src/index.ts": "export const hello = 'world';",
    "package.json": '{"name": "my-project"}',
  },
});

// Use just the bash tool
const result = await generateText({
  model: yourModel,
  tools: { bash },
  prompt: "Summarize the data",
});

// Or use all tools (bash, readFile, writeFile)
const result2 = await generateText({
  model: yourModel,
  tools,
  prompt: "Generate a markdown table of shirt colors",
});
```

## Advanced Usage

### Upload a local directory

```typescript
const { bash } = await createBashTool({
  uploadDirectory: {
    source: "./my-project",
    include: "**/*.{ts,json}", // optional glob filter
  },
});
```

### Use @vercel/sandbox for full VM

```typescript
import { Sandbox } from "@vercel/sandbox";

const sandbox = await Sandbox.create();
// Files are written to /workspace by default
const { tools } = await createBashTool({
  sandbox,
  files: { "index.ts": "console.log('hello');" },
});
```

### Persistent sandbox across serverless invocations

Use `Sandbox.get` to reconnect to an existing sandbox by ID:

```typescript
import { Sandbox } from "@vercel/sandbox";

// First invocation: create sandbox and store the ID
const sandbox = await Sandbox.create();
const sandboxId = sandbox.sandboxId;
// Store sandboxId in database, session, or return to client

// Subsequent invocations: reconnect to existing sandbox
const sandbox = await Sandbox.get({ sandboxId });
const { tools } = await createBashTool({ sandbox });
// All previous files and state are preserved
```

### Use a custom just-bash instance

```typescript
import { Bash } from "just-bash";

const sandbox = new Bash({ cwd: "/app" });
const { tools } = await createBashTool({
  sandbox,
  destination: "/app",
});
```

### Track tool calls

```typescript
const { tools } = await createBashTool({
  files: { "index.ts": "export const x = 1;" },
  onCall: (toolName, args) => {
    console.log(`Tool called: ${toolName}`, args);
  },
});
```

### Custom sandbox implementation

```typescript
import { createBashTool, Sandbox } from "bash-tool";

const customSandbox: Sandbox = {
  async executeCommand(command) {
    // Return { stdout, stderr, exitCode }
  },
  async readFile(path) {
    // Return file contents
  },
  async writeFile(path, content) {
    // Write file
  },
};

const { tools } = await createBashTool({ sandbox: customSandbox });
```

## AI Agent Instructions

For AI agents working with bash-tool, additional guidance is available in `AGENTS.md`:

```bash
cat node_modules/bash-tool/dist/AGENTS.md
```

## License

MIT
