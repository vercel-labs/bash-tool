import type { ToolExecutionOptions } from "ai";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandResult } from "./types.js";

// AI SDK tool execute requires (args, options) - we provide test options
const opts: ToolExecutionOptions = { toolCallId: "test", messages: [] };

// Mock AI SDK
vi.mock("ai", () => ({
  tool: vi.fn((config) => ({
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  })),
}));

// Mock just-bash with a simple in-memory implementation
const mockFiles: Record<string, string> = {};
let mockCwd = "/workspace";

vi.mock("just-bash", () => ({
  Bash: class MockBash {
    fs: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
    };

    constructor(options: { files?: Record<string, string>; cwd?: string }) {
      Object.assign(mockFiles, options.files || {});
      mockCwd = options.cwd || "/workspace";

      this.fs = {
        readFile: async (path: string) => {
          if (mockFiles[path]) {
            return mockFiles[path];
          }
          throw new Error(`ENOENT: no such file: ${path}`);
        },
        writeFile: async (path: string, content: string) => {
          mockFiles[path] = content;
        },
      };
    }

    async exec(command: string) {
      if (command === "ls") {
        const files = Object.keys(mockFiles).join("\n");
        return { stdout: files, stderr: "", exitCode: 0 };
      }

      // Handle combined ls for bin directories (tool discovery)
      if (command.startsWith("ls /usr/bin /usr/local/bin")) {
        return {
          stdout:
            "/usr/bin:\ncat\ngrep\nsed\nawk\nhead\ntail\nsort\ncut\n/usr/local/bin:\njq\nyq",
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "pwd") {
        return { stdout: mockCwd, stderr: "", exitCode: 0 };
      }

      return { stdout: "", stderr: "", exitCode: 0 };
    }
  },
  OverlayFs: class MockOverlayFs {
    private root: string;
    constructor(options: { root: string }) {
      this.root = options.root;
    }
    getMountPoint() {
      return `/home/user/project`;
    }
  },
}));

import { createBashTool } from "./tool.js";

describe("createBashTool", () => {
  beforeEach(() => {
    // Clear mock files
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
  });

  it("creates toolkit with default just-bash sandbox", async () => {
    const { tools, sandbox } = await createBashTool();

    expect(tools.bash).toBeDefined();
    expect(tools.readFile).toBeDefined();
    expect(tools.writeFile).toBeDefined();
    expect(sandbox).toBeDefined();
    expect(typeof sandbox.executeCommand).toBe("function");
    expect(typeof sandbox.readFile).toBe("function");
    expect(typeof sandbox.writeFiles).toBe("function");
  });

  it("writes inline files to destination", async () => {
    await createBashTool({
      files: {
        "src/index.ts": "export const x = 1;",
        "package.json": '{"name": "test"}',
      },
    });

    expect(mockFiles["/workspace/src/index.ts"]).toBe("export const x = 1;");
    expect(mockFiles["/workspace/package.json"]).toBe('{"name": "test"}');
  });

  it("uses custom destination", async () => {
    await createBashTool({
      destination: "/home/user/app",
      files: {
        "index.ts": "console.log('hello');",
      },
    });

    expect(mockFiles["/home/user/app/index.ts"]).toBe("console.log('hello');");
  });

  it("bash tool executes commands", async () => {
    const { tools } = await createBashTool({
      files: { "test.txt": "hello world" },
    });

    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "ls" },
      opts,
    )) as CommandResult;
    expect(result.exitCode).toBe(0);
  });

  it("readFile tool reads files", async () => {
    const { tools } = await createBashTool({
      files: { "test.txt": "hello world" },
    });

    assert(tools.readFile.execute, "readFile.execute should be defined");
    const result = (await tools.readFile.execute(
      { path: "/workspace/test.txt" },
      opts,
    )) as { content: string };
    expect(result.content).toBe("hello world");
  });

  it("writeFile tool writes files", async () => {
    const { tools } = await createBashTool();

    assert(tools.writeFile.execute, "writeFile.execute should be defined");
    const result = (await tools.writeFile.execute(
      { path: "/workspace/new-file.txt", content: "new content" },
      opts,
    )) as { success: boolean };

    expect(result.success).toBe(true);
  });

  it("readFile tool resolves relative paths against cwd", async () => {
    const { tools } = await createBashTool({
      files: { "test.txt": "hello world" },
    });

    assert(tools.readFile.execute, "readFile.execute should be defined");
    // Use relative path - should resolve to /workspace/test.txt
    const result = (await tools.readFile.execute(
      { path: "test.txt" },
      opts,
    )) as { content: string };
    expect(result.content).toBe("hello world");
  });

  it("writeFile tool resolves relative paths against cwd", async () => {
    const { tools } = await createBashTool();

    assert(tools.writeFile.execute, "writeFile.execute should be defined");
    // Use relative path - should resolve to /workspace/relative.txt
    await tools.writeFile.execute(
      { path: "relative.txt", content: "relative content" },
      opts,
    );

    expect(mockFiles["/workspace/relative.txt"]).toBe("relative content");
  });

  it("readFile tool uses custom destination for relative paths", async () => {
    const { tools } = await createBashTool({
      destination: "/custom/dest",
      files: { "data.txt": "custom data" },
    });

    assert(tools.readFile.execute, "readFile.execute should be defined");
    const result = (await tools.readFile.execute(
      { path: "data.txt" },
      opts,
    )) as { content: string };
    expect(result.content).toBe("custom data");
  });

  it("writeFile tool uses custom destination for relative paths", async () => {
    const { tools } = await createBashTool({
      destination: "/custom/dest",
    });

    assert(tools.writeFile.execute, "writeFile.execute should be defined");
    await tools.writeFile.execute(
      { path: "new.txt", content: "new data" },
      opts,
    );

    expect(mockFiles["/custom/dest/new.txt"]).toBe("new data");
  });

  it("readFile tool preserves absolute paths", async () => {
    mockFiles["/absolute/path/file.txt"] = "absolute content";
    const { tools } = await createBashTool();

    assert(tools.readFile.execute, "readFile.execute should be defined");
    const result = (await tools.readFile.execute(
      { path: "/absolute/path/file.txt" },
      opts,
    )) as { content: string };
    expect(result.content).toBe("absolute content");
  });

  it("writeFile tool preserves absolute paths", async () => {
    const { tools } = await createBashTool();

    assert(tools.writeFile.execute, "writeFile.execute should be defined");
    await tools.writeFile.execute(
      { path: "/absolute/path/file.txt", content: "absolute content" },
      opts,
    );

    expect(mockFiles["/absolute/path/file.txt"]).toBe("absolute content");
  });

  it("calls onBeforeBashCall and onAfterBashCall callbacks", async () => {
    const onBeforeBashCall = vi.fn();
    const onAfterBashCall = vi.fn();
    const { tools } = await createBashTool({
      onBeforeBashCall,
      onAfterBashCall,
      files: { "test.txt": "hello" },
    });

    assert(tools.bash.execute, "bash.execute should be defined");

    await tools.bash.execute({ command: "ls" }, opts);

    expect(onBeforeBashCall).toHaveBeenCalledWith({ command: "ls" });
    expect(onAfterBashCall).toHaveBeenCalledWith({
      command: "ls",
      result: expect.objectContaining({ exitCode: expect.any(Number) }),
    });
  });

  it("allows onBeforeBashCall to modify command", async () => {
    const onBeforeBashCall = vi.fn().mockReturnValue({ command: "pwd" });
    const onAfterBashCall = vi.fn();
    const { tools } = await createBashTool({
      onBeforeBashCall,
      onAfterBashCall,
    });

    assert(tools.bash.execute, "bash.execute should be defined");

    await tools.bash.execute({ command: "ls" }, opts);

    // onBeforeBashCall receives the original command
    expect(onBeforeBashCall).toHaveBeenCalledWith({ command: "ls" });
    // onAfterBashCall receives the modified command
    expect(onAfterBashCall).toHaveBeenCalledWith({
      command: "pwd",
      result: expect.objectContaining({ exitCode: expect.any(Number) }),
    });
  });

  it("allows onAfterBashCall to modify result", async () => {
    const onAfterBashCall = vi.fn().mockReturnValue({
      result: { stdout: "modified output", stderr: "", exitCode: 42 },
    });
    const { tools } = await createBashTool({
      onAfterBashCall,
    });

    assert(tools.bash.execute, "bash.execute should be defined");

    const result = (await tools.bash.execute(
      { command: "echo test" },
      opts,
    )) as CommandResult;

    expect(result.stdout).toBe("modified output");
    expect(result.exitCode).toBe(42);
  });

  it("accepts custom Sandbox implementation", async () => {
    const customSandbox = {
      executeCommand: vi
        .fn()
        .mockResolvedValue({ stdout: "custom", stderr: "", exitCode: 0 }),
      readFile: vi.fn().mockResolvedValue("custom content"),
      writeFiles: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { tools, sandbox } = await createBashTool({
      sandbox: customSandbox,
      files: { "test.txt": "content" },
    });

    expect(sandbox).toBe(customSandbox);

    // Files should be written to custom sandbox in a single call (as Buffer)
    expect(customSandbox.writeFiles).toHaveBeenCalledWith([
      { path: "/workspace/test.txt", content: Buffer.from("content") },
    ]);

    // Tools should use custom sandbox
    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "ls" },
      opts,
    )) as CommandResult;
    expect(result.stdout).toBe("custom");
  });

  it("writes files in batches of 20 to custom sandbox", async () => {
    const customSandbox = {
      executeCommand: vi
        .fn()
        .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
      readFile: vi.fn().mockResolvedValue(""),
      writeFiles: vi.fn().mockResolvedValue(undefined),
    };

    // Create 45 files (should result in 3 batches: 20 + 20 + 5)
    const files: Record<string, string> = {};
    for (let i = 0; i < 45; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    await createBashTool({
      sandbox: customSandbox,
      files,
    });

    // Should have been called 3 times (batches of 20, 20, 5)
    expect(customSandbox.writeFiles).toHaveBeenCalledTimes(3);

    // First batch should have 20 files
    expect(customSandbox.writeFiles.mock.calls[0][0]).toHaveLength(20);
    // Second batch should have 20 files
    expect(customSandbox.writeFiles.mock.calls[1][0]).toHaveLength(20);
    // Third batch should have 5 files
    expect(customSandbox.writeFiles.mock.calls[2][0]).toHaveLength(5);
  });
});

// Common description sections for tests
const OUTPUT_FILTERING_SECTION = `OUTPUT FILTERING:
Use the outputFilter parameter to filter stdout before it is returned.
Examples:
  outputFilter: "tail -50"      # Last 50 lines
  outputFilter: "head -100"     # First 100 lines
  outputFilter: "grep error"    # Lines containing "error"
  outputFilter: "grep -i warn"  # Case-insensitive search`;

describe("createBashTool tool prompt integration", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
  });

  it("includes available tools in bash tool description", async () => {
    const { tools } = await createBashTool({
      files: { "readme.txt": "hello" },
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  readme.txt

Available tools: awk, cat, cut, grep, head, jq, sed, sort, tail, yq, and more

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("includes format-specific hints for JSON files", async () => {
    const { tools } = await createBashTool({
      files: { "data.json": '{"key": "value"}' },
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  data.json

Available tools: awk, cat, cut, grep, head, jq, sed, sort, tail, yq, and more
For JSON: jq, grep, sed

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("includes format-specific hints for YAML files", async () => {
    const { tools } = await createBashTool({
      files: { "config.yaml": "key: value" },
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  config.yaml

Available tools: awk, cat, cut, grep, head, jq, sed, sort, tail, yq, and more
For YAML: yq, grep, sed

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("includes format-specific hints for multiple formats", async () => {
    const { tools } = await createBashTool({
      files: {
        "data.json": "{}",
        "config.yaml": "",
        "readme.md": "# Hello",
      },
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  data.json
  config.yaml
  readme.md

Available tools: awk, cat, cut, grep, head, jq, sed, sort, tail, yq, and more
For JSON: jq, grep, sed
For YAML: yq, grep, sed

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("includes yq for CSV when using just-bash sandbox", async () => {
    const { tools } = await createBashTool({
      files: { "data.csv": "a,b,c" },
    });

    // Default sandbox is just-bash, so yq should be included for CSV
    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  data.csv

Available tools: awk, cat, cut, grep, head, jq, sed, sort, tail, yq, and more
For CSV/TSV: yq, awk, cut

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("includes extraInstructions after tool prompt", async () => {
    const { tools } = await createBashTool({
      files: { "app.ts": "console.log('hi')" },
      extraInstructions: "Always use TypeScript.",
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  app.ts

Available tools: awk, cat, cut, grep, head, jq, sed, sort, tail, yq, and more

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}

Always use TypeScript.`);
  });

  it("uses custom destination in description", async () => {
    const { tools } = await createBashTool({
      destination: "/home/user/project",
      files: { "index.ts": "" },
    });

    expect(tools.bash.description).toContain(
      "WORKING DIRECTORY: /home/user/project",
    );
    expect(tools.bash.description).toContain("Available tools:");
  });

  it("uses custom toolPrompt from promptOptions", async () => {
    const { tools } = await createBashTool({
      files: { "data.json": "{}" },
      promptOptions: {
        toolPrompt: "Custom tools: myTool, otherTool",
      },
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  data.json

Custom tools: myTool, otherTool

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("uses empty string toolPrompt to disable tool hints", async () => {
    const { tools } = await createBashTool({
      files: { "data.json": "{}" },
      promptOptions: {
        toolPrompt: "",
      },
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  data.json

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("combines custom toolPrompt with extraInstructions", async () => {
    const { tools } = await createBashTool({
      files: { "app.ts": "" },
      promptOptions: {
        toolPrompt: "Use: node, npm",
      },
      extraInstructions: "Always run tests first.",
    });

    expect(
      tools.bash.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  app.ts

Use: node, npm

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}

Always run tests first.`);
  });
});

describe("createBashTool maxFiles limit", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFiles)) {
      delete mockFiles[key];
    }
  });

  it("throws error when exceeding default maxFiles limit with inline files", async () => {
    // Create more than 1000 files
    const files: Record<string, string> = {};
    for (let i = 0; i < 1001; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    await expect(createBashTool({ files })).rejects.toThrow(
      /Too many files to load: 1001 files exceeds the limit of 1000/,
    );
  });

  it("throws error when exceeding custom maxFiles limit", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 11; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    await expect(createBashTool({ files, maxFiles: 10 })).rejects.toThrow(
      /Too many files to load: 11 files exceeds the limit of 10/,
    );
  });

  it("accepts exactly maxFiles number of files", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    // Should not throw
    const { tools } = await createBashTool({ files, maxFiles: 10 });
    expect(tools.bash).toBeDefined();
  });

  it("allows disabling maxFiles limit with 0", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    // Should not throw even with many files when limit is disabled
    const { tools } = await createBashTool({ files, maxFiles: 0 });
    expect(tools.bash).toBeDefined();
  });

  it("throws error with custom sandbox when exceeding maxFiles", async () => {
    const customSandbox = {
      executeCommand: vi
        .fn()
        .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
      readFile: vi.fn().mockResolvedValue(""),
      writeFiles: vi.fn().mockResolvedValue(undefined),
    };

    const files: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    await expect(
      createBashTool({
        sandbox: customSandbox,
        files,
        maxFiles: 5,
      }),
    ).rejects.toThrow(
      /Too many files to upload: 6 files exceeds the limit of 5/,
    );

    // writeFiles should not have been called since error was thrown before streaming
    expect(customSandbox.writeFiles).not.toHaveBeenCalled();
  });

  it("error message guides user to handle upload themselves", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 11; i++) {
      files[`file${i}.txt`] = `content${i}`;
    }

    try {
      await createBashTool({ files, maxFiles: 10 });
      expect.fail("Should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("increase maxFiles");
      expect(message).toContain("restrictive include pattern");
    }
  });
});
