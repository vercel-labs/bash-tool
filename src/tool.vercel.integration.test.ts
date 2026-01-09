import { Sandbox } from "@vercel/sandbox";
import type { ToolExecutionOptions } from "ai";
import { afterAll, assert, beforeAll, describe, expect, it } from "vitest";
import { createBashTool } from "./tool.js";
import type { CommandResult } from "./types.js";

// AI SDK tool execute requires (args, options) - we provide test options
const opts: ToolExecutionOptions = { toolCallId: "test", messages: [] };

/**
 * Integration tests that verify createBashTool works correctly
 * with the real @vercel/sandbox environment.
 *
 * These tests require Vercel OIDC authentication.
 * Run with: pnpm test:vercel
 *
 * Note: createBashTool automatically uses /vercel/sandbox as the default
 * destination when a @vercel/sandbox instance is provided.
 */
describe("createBashTool @vercel/sandbox integration", () => {
  let vercelSandbox: Sandbox;

  const testFiles = {
    "src/index.ts": 'export const hello = "world";',
    "src/utils/helpers.ts":
      "export function add(a: number, b: number) { return a + b; }",
    "src/utils/format.ts":
      "export function format(s: string) { return s.trim(); }",
    "package.json": '{"name": "test-project", "version": "1.0.0"}',
    "README.md": "# Test Project\n\nThis is a test project.",
  };

  beforeAll(async () => {
    vercelSandbox = await Sandbox.create();
  }, 60000);

  afterAll(async () => {
    if (vercelSandbox) {
      await vercelSandbox.stop();
    }
  });

  describe("ls command", () => {
    it("ls -la lists files with details", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
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
    }, 30000);

    it("ls lists directory contents", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "ls src" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("index.ts\nutils");
    }, 30000);
  });

  describe("find command", () => {
    it("find . -name '*.ts' finds TypeScript files", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
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
    }, 30000);

    it("find . -name '*.json' finds JSON files", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "find . -name '*.json'" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("./package.json");
    }, 30000);
  });

  describe("grep command", () => {
    it("grep -r 'pattern' . searches file contents", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
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
    }, 30000);

    it("grep finds specific patterns", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "grep -r 'hello' ." },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(
        './src/index.ts:export const hello = "world";',
      );
    }, 30000);
  });

  describe("cat command", () => {
    it("cat <file> views file contents", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat src/index.ts" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('export const hello = "world";');
    }, 30000);

    it("cat package.json shows JSON content", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat package.json" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        '{"name": "test-project", "version": "1.0.0"}',
      );
    }, 30000);
  });

  describe("working directory", () => {
    it("pwd shows correct working directory", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "pwd" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/vercel/sandbox/workspace");
    }, 30000);

    it("pwd shows custom destination within sandbox", async () => {
      const customDest = "/vercel/sandbox/project";
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
        destination: customDest,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "pwd" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(customDest);
    }, 30000);
  });

  describe("readFile tool", () => {
    it("reads file content correctly", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.readFile.execute, "readFile.execute should be defined");
      const result = (await tools.readFile.execute(
        { path: "/vercel/sandbox/workspace/src/index.ts" },
        opts,
      )) as { content: string };

      expect(result.content).toBe('export const hello = "world";');
    }, 30000);
  });

  describe("writeFile tool", () => {
    it("writes file and can be read back", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: testFiles,
      });

      assert(tools.writeFile.execute, "writeFile.execute should be defined");
      assert(tools.bash.execute, "bash.execute should be defined");

      await tools.writeFile.execute(
        {
          path: "/vercel/sandbox/workspace/newfile.txt",
          content: "Hello, World!",
        },
        opts,
      );

      const result = (await tools.bash.execute(
        { command: "cat newfile.txt" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("Hello, World!");
    }, 30000);
  });

  describe("promptOptions", () => {
    it("uses custom toolPrompt when provided", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: { "data.json": "{}" },
        promptOptions: {
          toolPrompt: "Custom tools: myTool",
        },
      });

      expect(tools.bash.description).toContain("Custom tools: myTool");
      expect(tools.bash.description).not.toContain("Available tools:");
    }, 30000);

    it("disables tool hints with empty string toolPrompt", async () => {
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        files: { "data.json": "{}" },
        promptOptions: {
          toolPrompt: "",
        },
      });

      expect(tools.bash.description).not.toContain("Available tools:");
      expect(tools.bash.description).not.toContain("For JSON:");
    }, 30000);
  });
});
