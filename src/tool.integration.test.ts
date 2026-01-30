import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ToolExecutionOptions } from "ai";
import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";
import { createBashTool } from "./tool.js";
import type { CommandResult } from "./types.js";

// AI SDK tool execute requires (args, options) - we provide test options
const opts: ToolExecutionOptions = { toolCallId: "test", messages: [] };

/**
 * Integration tests that verify the documented bash commands work correctly
 * with the real just-bash sandbox environment.
 */
describe("createBashTool integration", () => {
  const testFiles = {
    "src/index.ts": 'export const hello = "world";',
    "src/utils/helpers.ts":
      "export function add(a: number, b: number) { return a + b; }",
    "src/utils/format.ts":
      "export function format(s: string) { return s.trim(); }",
    "package.json": '{"name": "test-project", "version": "1.0.0"}',
    "README.md": "# Test Project\n\nThis is a test project.",
  };

  describe("ls command", () => {
    it("ls -la lists files with details", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "ls -la" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("src");
      expect(result.stdout).toContain("package.json");
      expect(result.stdout).toContain("README.md");
    });

    it("ls lists directory contents", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "ls src" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("utils");
    });
  });

  describe("find command", () => {
    it("find . -name '*.ts' finds TypeScript files", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "find . -name '*.ts'" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("helpers.ts");
      expect(result.stdout).toContain("format.ts");
      expect(result.stdout).not.toContain("package.json");
    });

    it("find . -name '*.json' finds JSON files", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "find . -name '*.json'" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("package.json");
      expect(result.stdout).not.toContain("index.ts");
    });
  });

  describe("grep command", () => {
    it("grep -r 'pattern' . searches file contents", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "grep -r 'export' ." },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("helpers.ts");
      expect(result.stdout).toContain("format.ts");
    });

    it("grep finds specific patterns", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "grep -r 'hello' ." },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("world");
    });
  });

  describe("cat command", () => {
    it("cat <file> views file contents", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat src/index.ts" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('export const hello = "world";');
    });

    it("cat package.json shows JSON content", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat package.json" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('"name": "test-project"');
      expect(result.stdout).toContain('"version": "1.0.0"');
    });
  });

  describe("working directory", () => {
    it("pwd shows correct working directory", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
        destination: "/workspace",
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "pwd" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/workspace");
    });

    it("pwd shows custom destination", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
        destination: "/home/user/project",
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "pwd" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/home/user/project");
    });
  });

  describe("readFile tool", () => {
    it("reads file content correctly", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.readFile.execute, "readFile.execute should be defined");
      const result = (await tools.readFile.execute(
        { path: "/workspace/src/index.ts" },
        opts,
      )) as { content: string };

      expect(result.content).toBe('export const hello = "world";');
    });

    it("applies outputFilter to file content", async () => {
      const { tools } = await createBashTool({
        files: {
          "multiline.txt": "line1\nline2\nline3\nline4\nline5",
        },
      });

      assert(tools.readFile.execute, "readFile.execute should be defined");
      const result = (await tools.readFile.execute(
        { path: "multiline.txt", outputFilter: "tail -2" },
        opts,
      )) as { content: string };

      expect(result.content.trim()).toBe("line4\nline5");
    });

    it("applies grep filter to file content", async () => {
      const { tools } = await createBashTool({
        files: {
          "log.txt": "INFO: started\nERROR: failed\nINFO: done\nERROR: timeout",
        },
      });

      assert(tools.readFile.execute, "readFile.execute should be defined");
      const result = (await tools.readFile.execute(
        { path: "log.txt", outputFilter: "grep ERROR" },
        opts,
      )) as { content: string };

      expect(result.content).toContain("ERROR: failed");
      expect(result.content).toContain("ERROR: timeout");
      expect(result.content).not.toContain("INFO");
    });
  });

  describe("outputFilter", () => {
    it("filters bash command output with tail", async () => {
      const { tools } = await createBashTool({
        files: {
          "numbers.txt": "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
        },
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat numbers.txt", outputFilter: "tail -3" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("8\n9\n10");
    });

    it("filters bash command output with grep", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "find . -type f", outputFilter: "grep -E '\\.ts$'" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("helpers.ts");
      expect(result.stdout).not.toContain("package.json");
    });

    it("filters bash command output with head", async () => {
      const { tools } = await createBashTool({
        files: {
          "data.txt": "a\nb\nc\nd\ne",
        },
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat data.txt", outputFilter: "head -2" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("a\nb");
    });
  });

  describe("invocation logging", () => {
    it("stores full output and returns filtered output", async () => {
      const { tools } = await createBashTool({
        files: {
          "numbers.txt": "1\n2\n3\n4\n5",
        },
        enableInvocationLog: true,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      assert(tools.readFile.execute, "readFile.execute should be defined");

      const result = (await tools.bash.execute(
        { command: "cat numbers.txt", outputFilter: "tail -2" },
        opts,
      )) as CommandResult & { invocationLogPath: string };

      // Filtered output returned
      expect(result.stdout.trim()).toBe("4\n5");
      expect(result.invocationLogPath).toMatch(/\.invocation$/);

      // Full output available in log
      const logResult = (await tools.readFile.execute(
        { path: result.invocationLogPath },
        opts,
      )) as { content: string };

      expect(logResult.content).toContain("1\n2\n3\n4\n5");
    });

    it("allows re-filtering invocation log", async () => {
      const { tools } = await createBashTool({
        files: {
          "log.txt":
            "INFO: start\nERROR: fail1\nINFO: middle\nERROR: fail2\nINFO: end",
        },
        enableInvocationLog: true,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      assert(tools.readFile.execute, "readFile.execute should be defined");

      // First, get last 2 lines
      const result = (await tools.bash.execute(
        { command: "cat log.txt", outputFilter: "tail -2" },
        opts,
      )) as CommandResult & { invocationLogPath: string };

      expect(result.stdout).toContain("fail2");
      expect(result.stdout).toContain("end");

      // Now re-filter the full log for errors only
      const errorResult = (await tools.readFile.execute(
        { path: result.invocationLogPath, outputFilter: "grep ERROR" },
        opts,
      )) as { content: string };

      expect(errorResult.content).toContain("ERROR: fail1");
      expect(errorResult.content).toContain("ERROR: fail2");
      expect(errorResult.content).not.toContain("INFO");
    });
  });

  describe("writeFile tool", () => {
    it("writes file and can be read back", async () => {
      const { tools } = await createBashTool({
        files: testFiles,
      });

      assert(tools.writeFile.execute, "writeFile.execute should be defined");
      assert(tools.bash.execute, "bash.execute should be defined");

      await tools.writeFile.execute(
        { path: "/workspace/newfile.txt", content: "Hello, World!" },
        opts,
      );

      const result = (await tools.bash.execute(
        { command: "cat newfile.txt" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("Hello, World!");
    });
  });
});

/**
 * Integration tests for OverlayFs mode (uploadDirectory without external sandbox).
 * This uses just-bash's OverlayFs for copy-on-write over a real directory.
 */
describe("createBashTool OverlayFs integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bash-tool-overlay-"));

    // Create test files on disk
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src/index.ts"),
      "export const x = 1;",
    );
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      '{"name": "overlay-test"}',
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("reads files from disk via OverlayFs", async () => {
    const { tools } = await createBashTool({
      uploadDirectory: { source: tempDir },
    });

    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "cat src/index.ts" },
      opts,
    )) as CommandResult;

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("export const x = 1;");
  });

  it("lists files from disk", async () => {
    const { tools } = await createBashTool({
      uploadDirectory: { source: tempDir },
    });

    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "ls" },
      opts,
    )) as CommandResult;

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("src");
    expect(result.stdout).toContain("package.json");
  });

  it("writes stay in memory (copy-on-write)", async () => {
    const { tools } = await createBashTool({
      uploadDirectory: { source: tempDir },
    });

    assert(tools.bash.execute, "bash.execute should be defined");

    // Write a new file
    await tools.bash.execute(
      { command: 'echo "new content" > newfile.txt' },
      opts,
    );

    // Can read the new file in sandbox
    const catResult = (await tools.bash.execute(
      { command: "cat newfile.txt" },
      opts,
    )) as CommandResult;
    expect(catResult.exitCode).toBe(0);
    expect(catResult.stdout.trim()).toBe("new content");

    // But file doesn't exist on real disk
    const diskPath = path.join(tempDir, "newfile.txt");
    await expect(fs.access(diskPath)).rejects.toThrow();
  });

  it("uses correct working directory from mount point", async () => {
    const { tools } = await createBashTool({
      uploadDirectory: { source: tempDir },
    });

    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "pwd" },
      opts,
    )) as CommandResult;

    expect(result.exitCode).toBe(0);
    // Should be at the overlay mount point, not /workspace
    expect(result.stdout.trim()).toContain("/home/user/project");
  });

  it("filters files with include glob", async () => {
    const { tools } = await createBashTool({
      uploadDirectory: { source: tempDir, include: "**/*.ts" },
    });

    // The tool prompt should only include .ts files
    expect(tools.bash.description).toContain("src/index.ts");
    expect(tools.bash.description).not.toContain("package.json");
  });
});
