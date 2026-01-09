# bash-tool

Generic bash tool for AI agents, compatible with [AI SDK](https://ai-sdk.dev/).

## Installation

```bash
npm install bash-tool just-bash
```

For full VM support, install [`@vercel/sandbox`](https://vercel.com/docs/vercel-sandbox) or another sandbox product instead of `just-bash`.

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

## Tools

The `tools` object contains three tools that can be used by AI agents:

### `bash`

Execute bash commands in the sandbox environment. For analysis agents, this may be the only tool you need to give to the agent.

**Input:**

- `command` (string): The bash command to execute

**Returns:**

- `stdout` (string): Standard output from the command
- `stderr` (string): Standard error from the command
- `exitCode` (number): Exit code of the command

### `readFile`

Read the contents of a file from the sandbox.

**Input:**

- `path` (string): The path to the file to read

**Returns:**

- `content` (string): The file contents

### `writeFile`

Write content to a file in the sandbox. Creates parent directories if needed.

**Input:**

- `path` (string): The path where the file should be written
- `content` (string): The content to write to the file

**Returns:**

- `success` (boolean): `true` if the write succeeded

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

### Use [@vercel/sandbox](https://vercel.com/docs/vercel-sandbox) for full VM

```typescript
import { Sandbox } from "@vercel/sandbox";

const sandbox = await Sandbox.create();
// Files are written to ./workspace by default
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

### Intercept bash commands

```typescript
const { tools } = await createBashTool({
  onBeforeBashCall: ({ command }) => {
    console.log("Running:", command);
    // Optionally modify the command
    if (command.includes("rm -rf")) {
      return { command: "echo 'Blocked dangerous command'" };
    }
  },
  onAfterBashCall: ({ command, result }) => {
    console.log(`Exit code: ${result.exitCode}`);
    // Optionally modify the result
    return { result: { ...result, stdout: result.stdout.trim() } };
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
