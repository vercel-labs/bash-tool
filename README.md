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
import { ToolLoopAgent, stepCountIs } from "ai";

const { tools } = await createBashTool({
  files: {
    "src/index.ts": "export const hello = 'world';",
    "package.json": '{"name": "my-project"}',
  },
});

const agent = new ToolLoopAgent({
  model: yourModel,
  tools,
  // Or use just the bash tool as tools: {bash: tools.bash}
  stopWhen: stepCountIs(20),
});

const result = await agent.generate({
  prompt: "Analyze the project and create a summary report",
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
const newSandbox = await Sandbox.create();
const sandboxId = newSandbox.sandboxId;
// Store sandboxId in database, session, or return to client

// Subsequent invocations: reconnect to existing sandbox
const existingSandbox = await Sandbox.get({ sandboxId });
const { tools } = await createBashTool({ sandbox: existingSandbox });
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
    // Your implementation here
    return { stdout: "", stderr: "", exitCode: 0 };
  },
  async readFile(path) {
    // Your implementation here
    return "";
  },
  async writeFile(path, content) {
    // Your implementation here
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
