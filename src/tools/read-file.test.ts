import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReadFileTool } from "./read-file.js";

/**
 * Helper to format invocation log in the text format used by bash tool.
 */
function formatInvocationLog(log: {
  timestamp: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  outputFilter?: string;
}): string {
  const lines: string[] = [
    `# timestamp: ${log.timestamp}`,
    `# command: ${log.command}`,
    `# exitCode: ${log.exitCode}`,
  ];
  if (log.outputFilter) {
    lines.push(`# outputFilter: ${log.outputFilter}`);
  }
  lines.push("---STDOUT---");
  lines.push(log.stdout);
  lines.push("---STDERR---");
  lines.push(log.stderr);
  return lines.join("\n");
}

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

describe("createReadFileTool", () => {
  beforeEach(() => {
    mockSandbox = createMockSandbox();
  });

  it("reads file content", async () => {
    mockSandbox.readFile.mockResolvedValue("file content");

    const tool = createReadFileTool({
      sandbox: mockSandbox,
      cwd: "/workspace",
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    const result = (await tool.execute!({ path: "test.txt" }, {} as never)) as {
      content: string;
    };

    expect(result.content).toBe("file content");
    expect(mockSandbox.readFile).toHaveBeenCalledWith("/workspace/test.txt");
  });

  it("resolves relative paths against cwd", async () => {
    mockSandbox.readFile.mockResolvedValue("content");

    const tool = createReadFileTool({
      sandbox: mockSandbox,
      cwd: "/app/project",
    });

    // biome-ignore lint/style/noNonNullAssertion: test mock
    await tool.execute!({ path: "src/index.ts" }, {} as never);

    expect(mockSandbox.readFile).toHaveBeenCalledWith(
      "/app/project/src/index.ts",
    );
  });

  describe("invocation file handling", () => {
    it("extracts stdout from .invocation files using sed", async () => {
      // Now uses sed to extract stdout, mock executeCommand
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "file1.txt\nfile2.txt",
        stderr: "",
        exitCode: 0,
      });

      const tool = createReadFileTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { path: ".bash-tool/commands/2024-01-15T10-30-45.123Z.invocation" },
        {} as never,
      )) as { content: string };

      expect(result.content).toBe("file1.txt\nfile2.txt");
      // Verify sed command was used to extract stdout section
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining("sed -n"),
      );
    });

    it("falls back to readFile if sed fails", async () => {
      // Sed fails
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "",
        stderr: "error",
        exitCode: 1,
      });
      // Fallback readFile returns the raw content
      const invocationLog = formatInvocationLog({
        timestamp: "2024-01-15T10:30:45.123Z",
        command: "ls -la",
        exitCode: 0,
        stdout: "fallback content",
        stderr: "",
      });
      mockSandbox.readFile.mockResolvedValue(invocationLog);

      const tool = createReadFileTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { path: "test.invocation" },
        {} as never,
      )) as { content: string };

      expect(result.content).toBe("fallback content");
    });
  });

  describe("output filtering", () => {
    it("applies outputFilter using cat and pipe", async () => {
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "line3",
        stderr: "",
        exitCode: 0,
      });

      const tool = createReadFileTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { path: "test.txt", outputFilter: "tail -1" },
        {} as never,
      )) as { content: string };

      expect(result.content).toBe("line3");
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith(
        'cd "/workspace" && cat "/workspace/test.txt" | tail -1',
      );
    });

    it("returns error when filter fails", async () => {
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "",
        stderr: "grep: invalid pattern",
        exitCode: 1,
      });

      const tool = createReadFileTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { path: "test.txt", outputFilter: "grep '['" },
        {} as never,
      )) as { content: string; error: string };

      expect(result.error).toContain("Filter error");
    });

    it("applies filter to invocation file stdout using sed and pipe", async () => {
      // Now uses sed to extract stdout and pipe through filter in one command
      mockSandbox.executeCommand.mockResolvedValue({
        stdout: "line3",
        stderr: "",
        exitCode: 0,
      });

      const tool = createReadFileTool({
        sandbox: mockSandbox,
        cwd: "/workspace",
      });

      // biome-ignore lint/style/noNonNullAssertion: test mock
      const result = (await tool.execute!(
        { path: "test.invocation", outputFilter: "tail -1" },
        {} as never,
      )) as { content: string };

      expect(result.content).toBe("line3");
      // Verify sed + filter command was used
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining("sed -n"),
      );
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining("| tail -1"),
      );
    });
  });
});
