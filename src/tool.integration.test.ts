import type { ToolExecutionOptions } from "ai";
import { assert, describe, expect, it } from "vitest";
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
