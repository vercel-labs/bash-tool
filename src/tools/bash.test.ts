import { describe, expect, it, vi } from "vitest";
import { createBashExecuteTool, DEFAULT_MAX_OUTPUT_LENGTH } from "./bash.js";

// Mock AI SDK
vi.mock("ai", () => ({
  tool: vi.fn((config) => ({
    description: config.description,
    parameters: config.parameters,
    execute: config.execute,
  })),
}));

const mockSandbox = {
  executeCommand: vi.fn(),
  readFile: vi.fn(),
  writeFiles: vi.fn(),
  stop: vi.fn(),
};

describe("createBashExecuteTool", () => {
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
  cat <file>          # View file contents`);
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
  cat <file>          # View file contents`);
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
  cat <file>          # View file contents`);
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
  cat <file>          # View file contents`);
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

  it("includes tee description when experimentalTeeTransform is true", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      experimentalTeeTransform: true,
    });

    expect(tool.description).toContain("INTERMEDIATE OUTPUT CAPTURE:");
    expect(tool.description).toContain("/tmp/bash-tool/");
    expect(tool.description).toContain("`teeFiles`");
    expect(tool.description).toContain("`stdoutFile`");
  });

  it("excludes tee description when experimentalTeeTransform is false", () => {
    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
    });

    expect(tool.description).not.toContain("INTERMEDIATE OUTPUT CAPTURE:");
  });

  it("returns teeFiles when experimentalTeeTransform is true", async () => {
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: "hello",
      stderr: "",
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
      experimentalTeeTransform: true,
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo hello | grep hello" },
      {} as never,
    )) as {
      stdout: string;
      teeFiles: Array<{ command: string; stdoutFile: string }>;
    };

    expect(result.teeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: expect.any(String),
          stdoutFile: expect.stringContaining("/tmp/bash-tool/"),
        }),
      ]),
    );
  });

  it("does not return teeFiles when experimentalTeeTransform is off", async () => {
    mockSandbox.executeCommand.mockResolvedValue({
      stdout: "hello",
      stderr: "",
      exitCode: 0,
    });

    const tool = createBashExecuteTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!(
      { command: "echo hello | grep hello" },
      {} as never,
    )) as {
      stdout: string;
      teeFiles?: unknown;
    };

    expect(result.teeFiles).toBeUndefined();
  });
});
