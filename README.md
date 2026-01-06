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

const { bash, tools, sandbox } = await createBashTool({
  files: {
    "src/index.ts": "export const hello = 'world';",
    "package.json": '{"name": "my-project"}',
  },
});

// Use just the bash tool
const result = await generateText({
  model: yourModel,
  tools: { bash },
  prompt: "List all TypeScript files",
});

// Or use all tools (bash, readFile, writeFile)
const result2 = await generateText({
  model: yourModel,
  tools,
  prompt: "Read the package.json file",
});

await sandbox.stop();
```

## Options

```typescript
interface CreateBashToolOptions {
  // Directory on sandbox for files and working directory (default: "/workspace")
  destination?: string;

  // Inline files to write
  files?: Record<string, string>;

  // Upload directory from disk
  uploadDirectory?: {
    source: string;
    include?: string; // glob pattern, default "**/*"
  };

  // Custom sandbox (just-bash, @vercel/sandbox, or Sandbox interface)
  sandbox?: Sandbox | VercelSandboxInstance | JustBashInstance;

  // Additional instructions for LLM
  extraInstructions?: string;

  // Callback before each tool execution
  onCall?: (toolName: string, args: unknown) => void;
}
```

## Using a custom just-bash

Pass a `Bash` instance directly:

```typescript
import { createBashTool } from "bash-tool";
import { Bash } from "just-bash";

const bash = new Bash({ cwd: "/workspace" });
const { tools } = await createBashTool({ sandbox: bash });
```

## Using @vercel/sandbox

Pass a sandbox instance directly:

```typescript
import { createBashTool } from "bash-tool";
import { Sandbox } from "@vercel/sandbox";

const sandbox = await Sandbox.create();
const { tools } = await createBashTool({ sandbox });
```

## Custom Sandbox

Implement the `Sandbox` interface for other execution environments:

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
  async stop() {
    // Cleanup
  },
};

const { tools } = await createBashTool({ sandbox: customSandbox });
```

## License

MIT
