import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBashExecuteTool,
  DEFAULT_INVOCATION_LOG_PATH,
  DEFAULT_MAX_OUTPUT_LENGTH,
  parseInvocationLog,
} from "./bash.js";

// Mock AI SDK
vi.mock("ai", () => ({
  tool: vi.fn((config) => ({
    description: config.description,
    parameters: config.parameters,
    execute: config.execute,
  })),
}));

function createMockSandbox() {
  return {
    executeCommand: vi.fn(),
    readFile: vi.fn(),
    writeFiles: vi.fn(),
    stop: vi.fn(),
  };
}

let mockSandbox = createMockSandbox();

// Common description sections for tests
const OUTPUT_FILTERING_SECTION = `OUTPUT FILTERING:
Use the outputFilter parameter to filter stdout before it is returned.
Examples:
  outputFilter: "tail -50"      # Last 50 lines
  outputFilter: "head -100"     # First 100 lines
  outputFilter: "grep error"    # Lines containing "error"
  outputFilter: "grep -i warn"  # Case-insensitive search`;

describe("createBashExecuteTool", () => {
  beforeEach(() => {
    mockSandbox = createMockSandbox();
  });

  it("generates description with cwd only", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
    });

    expect(
      tool.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("generates description with files list", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      files: ["src/index.ts", "src/utils.ts", "package.json"],
    });

    expect(
      tool.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Available files:
  src/index.ts
  src/utils.ts
  package.json

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("generates description with truncated files list when more than 8", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/app",
      files: [
        "src/index.ts",
        "src/utils.ts",
        "src/types.ts",
        "src/config.ts",
        "src/api.ts",
        "src/db.ts",
        "src/auth.ts",
        "src/routes.ts",
        "src/middleware.ts",
        "src/helpers.ts",
        "package.json",
      ],
    });

    expect(
      tool.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /app
All commands execute from this directory. Use relative paths from here.

Available files:
  src/index.ts
  src/utils.ts
  src/types.ts
  src/config.ts
  src/api.ts
  src/db.ts
  src/auth.ts
  src/routes.ts
  ... and 3 more files

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("generates description with extra instructions", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      extraInstructions: "Focus on TypeScript files only.",
    });

    expect(
      tool.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}

Focus on TypeScript files only.`);
  });

  it("generates description with files and extra instructions", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/home/user/project",
      files: ["main.py", "requirements.txt"],
      extraInstructions: "This is a Python project.",
    });

    expect(
      tool.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /home/user/project
All commands execute from this directory. Use relative paths from here.

Available files:
  main.py
  requirements.txt

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}

This is a Python project.`);
  });

  it("generates description with empty files array", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      files: [],
    });

    expect(
      tool.description,
    ).toBe(`Execute bash commands in the sandbox environment.

WORKING DIRECTORY: /workspace
All commands execute from this directory. Use relative paths from here.

Common operations:
  ls -la              # List files with details
  find . -name '*.ts' # Find files by pattern
  grep -r 'pattern' . # Search file contents
  cat <file>          # View file contents

${OUTPUT_FILTERING_SECTION}`);
  });

  it("truncates stdout when exceeding maxOutputLength", async () => {
    const longOutput = "x".repeat(150);
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: longOutput,
      stderr: "",
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      maxOutputLength: 100,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
      stderr: string;
    };

    expect(result.stdout).toBe(
      `${"x".repeat(100)}\n\n[stdout truncated: 50 characters removed]`,
    );
    expect(result.stderr).toBe("");
  });

  it("truncates stderr when exceeding maxOutputLength", async () => {
    const longError = "e".repeat(200);
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: "",
      stderr: longError,
      exitCode: 1,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      maxOutputLength: 100,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
      stderr: string;
    };

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      `${"e".repeat(100)}\n\n[stderr truncated: 100 characters removed]`,
    );
  });

  it("truncates both stdout and stderr independently", async () => {
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: "o".repeat(80),
      stderr: "e".repeat(80),
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      maxOutputLength: 50,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
      stderr: string;
    };

    expect(result.stdout).toBe(
      `${"o".repeat(50)}\n\n[stdout truncated: 30 characters removed]`,
    );
    expect(result.stderr).toBe(
      `${"e".repeat(50)}\n\n[stderr truncated: 30 characters removed]`,
    );
  });

  it("does not truncate when output is within limit", async () => {
    const normalOutput = "hello world";
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: normalOutput,
      stderr: "",
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      maxOutputLength: 100,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
      stderr: string;
    };

    expect(result.stdout).toBe(normalOutput);
    expect(result.stderr).toBe("");
  });

  it("does not truncate when output equals maxOutputLength", async () => {
    const exactOutput = "x".repeat(100);
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: exactOutput,
      stderr: "",
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      maxOutputLength: 100,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
      stderr: string;
    };

    expect(result.stdout).toBe(exactOutput);
    expect(result.stderr).toBe("");
  });

  it("uses default maxOutputLength when not specified", async () => {
    const longOutput = "x".repeat(DEFAULT_MAX_OUTPUT_LENGTH + 100);
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: longOutput,
      stderr: "",
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
    };

    expect(result.stdout).toBe(
      `${"x".repeat(DEFAULT_MAX_OUTPUT_LENGTH)}\n\n[stdout truncated: 100 characters removed]`,
    );
  });

  it("applies truncation before onAfterBashCall callback", async () => {
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: "x".repeat(150),
      stderr: "",
      exitCode: 0,
    });

    const onAfterBashCall = vi.fn(({ result }) => ({
      result: { ...result, stdout: `modified: ${result.stdout}` },
    }));

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      maxOutputLength: 100,
      onAfterBashCall,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo test" },
      {} as never,
    )) as {
      stdout: string;
    };

    // The callback receives the truncated output
    expect(onAfterBashCall).toHaveBeenCalledWith({
      command: "echo test",
      result: {
        stdout: `${"x".repeat(100)}\n\n[stdout truncated: 50 characters removed]`,
        stderr: "",
        exitCode: 0,
      },
    });
    // And the final result has the callback's modification
    expect(result.stdout).toBe(
      `modified: ${"x".repeat(100)}\n\n[stdout truncated: 50 characters removed]`,
    );
  });

  describe("invocation logging", () => {
    it("writes invocation log and returns path when enableInvocationLog is true", async () => {
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "hello world",
        stderr: "",
        exitCode: 0,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
        enableInvocationLog: true,
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "echo hello" },
        {} as never,
      )) as {
        stdout: string;
        invocationLogPath: string;
      };

      // Should create directory and write file
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith(
        `mkdir -p "/workspace/${DEFAULT_INVOCATION_LOG_PATH}"`,
      );
      expect(mockSandbox.writeFiles).toHaveBeenCalled();

      const writeCall = mockSandbox.writeFiles.mock.calls[0][0][0];
      expect(writeCall.path).toMatch(
        /\/workspace\/.bash-tool\/commands\/.*\.invocation$/,
      );

      const logContent = parseInvocationLog(writeCall.content);
      expect(logContent.command).toBe("echo hello");
      expect(logContent.stdout).toBe("hello world");
      expect(logContent.exitCode).toBe(0);

      // Response should include the log path
      expect(result.invocationLogPath).toMatch(
        /\/workspace\/.bash-tool\/commands\/.*\.invocation$/,
      );
      expect(result.invocationLogPath).toBe(writeCall.path);
    });

    it("does not write invocation log or return path when enableInvocationLog is false", async () => {
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "hello",
        stderr: "",
        exitCode: 0,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
        enableInvocationLog: false,
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "echo hello" },
        {} as never,
      )) as {
        stdout: string;
        invocationLogPath?: string;
      };

      expect(mockSandbox.writeFiles).not.toHaveBeenCalled();
      expect(result.invocationLogPath).toBeUndefined();
    });

    it("uses custom invocationLogPath and returns it", async () => {
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "test",
        stderr: "",
        exitCode: 0,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
        enableInvocationLog: true,
        invocationLogPath: "custom/logs",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "test" },
        {} as never,
      )) as {
        invocationLogPath: string;
      };

      expect(mockSandbox.executeCommand).toHaveBeenCalledWith(
        'mkdir -p "/workspace/custom/logs"',
      );

      const writeCall = mockSandbox.writeFiles.mock.calls[0][0][0];
      expect(writeCall.path).toMatch(
        /\/workspace\/custom\/logs\/.*\.invocation$/,
      );
      expect(result.invocationLogPath).toBe(writeCall.path);
    });

    it("includes outputFilter in invocation log and returns path", async () => {
      // With outputFilter, a single combined bash script is executed
      mockSandbox.executeCommand.mockResolvedValueOnce({
        stdout: "line3", // filtered output
        stderr: "",
        exitCode: 0,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
        enableInvocationLog: true,
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "echo test", outputFilter: "tail -1" },
        {} as never,
      )) as {
        stdout: string;
        invocationLogPath: string;
      };

      // With outputFilter, invocation log is written via bash script (not writeFiles)
      expect(mockSandbox.writeFiles).not.toHaveBeenCalled();
      // The log path should still be returned
      expect(result.invocationLogPath).toMatch(
        /\/workspace\/.bash-tool\/commands\/.*\.invocation$/,
      );
      // Filtered output should be returned
      expect(result.stdout).toBe("line3");
      // Single executeCommand call for the combined script
      expect(mockSandbox.executeCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe("output filtering", () => {
    it("applies outputFilter to stdout", async () => {
      // With outputFilter, a single combined bash script is executed
      // that returns filtered output directly
      mockSandbox.executeCommand.mockResolvedValueOnce({
        stdout: "line3", // filtered output from the combined script
        stderr: "",
        exitCode: 0,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "cat file", outputFilter: "tail -1" },
        {} as never,
      )) as { stdout: string };

      expect(result.stdout).toBe("line3");
      // Single executeCommand call for the combined script
      expect(mockSandbox.executeCommand).toHaveBeenCalledTimes(1);
    });

    it("returns filter exit code when filter fails", async () => {
      // When filter fails, the combined script exits with filter's exit code
      mockSandbox.executeCommand.mockResolvedValueOnce({
        stdout: "",
        stderr: "filter failed",
        exitCode: 1,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "echo test", outputFilter: "invalid-filter" },
        {} as never,
      )) as { stdout: string; stderr: string; exitCode: number };

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("filter failed");
    });

    it("does not apply filter when outputFilter is not provided", async () => {
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "original output",
        stderr: "",
        exitCode: 0,
      });

      const tool = createBashExecuteTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { command: "echo test" },
        {} as never,
      )) as { stdout: string };

      expect(result.stdout).toBe("original output");
      // Should only have one executeCommand call (the actual command)
      expect(mockSandbox.executeCommand).toHaveBeenCalledTimes(1);
    });
  });
});
