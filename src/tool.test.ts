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
    constructor(options: { files?: Record<string, string>; cwd?: string }) {
      Object.assign(mockFiles, options.files || {});
      mockCwd = options.cwd || "/workspace";
    }

    async exec(command: string) {
      // Simple command parsing for tests
      // Check heredoc write FIRST (before simple cat read)
      if (command.includes("cat >") && command.includes("BASH_TOOL_EOF")) {
        const match = command.match(/cat > "([^"]+)" << 'BASH_TOOL_EOF'/);
        if (match) {
          const filePath = match[1];
          // Extract content between the two BASH_TOOL_EOF markers
          const startMarker = "BASH_TOOL_EOF'\n";
          const endMarker = "\nBASH_TOOL_EOF";
          const startIdx = command.indexOf(startMarker) + startMarker.length;
          const endIdx = command.lastIndexOf(endMarker);
          const content = command.slice(startIdx, endIdx);
          mockFiles[filePath] = content;
          return { stdout: "", stderr: "", exitCode: 0 };
        }
      }

      if (command.startsWith("mkdir -p")) {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      // Simple cat read (after heredoc check)
      if (command.startsWith("cat ")) {
        const filePath = command.slice(4).replace(/"/g, "");
        if (mockFiles[filePath]) {
          return { stdout: mockFiles[filePath], stderr: "", exitCode: 0 };
        }
        return {
          stdout: "",
          stderr: `cat: ${filePath}: No such file`,
          exitCode: 1,
        };
      }

      if (command === "ls") {
        const files = Object.keys(mockFiles).join("\n");
        return { stdout: files, stderr: "", exitCode: 0 };
      }

      if (command === "pwd") {
        return { stdout: mockCwd, stderr: "", exitCode: 0 };
      }

      return { stdout: "", stderr: "", exitCode: 0 };
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
    expect(typeof sandbox.writeFile).toBe("function");
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
      writeFile: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { tools, sandbox } = await createBashTool({
      sandbox: customSandbox,
      files: { "test.txt": "content" },
    });

    expect(sandbox).toBe(customSandbox);

    // Files should be written to custom sandbox
    expect(customSandbox.writeFile).toHaveBeenCalledWith(
      "/workspace/test.txt",
      "content",
    );

    // Tools should use custom sandbox
    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "ls" },
      opts,
    )) as CommandResult;
    expect(result.stdout).toBe("custom");
  });
});
