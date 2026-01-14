// Excluded from pnpm test. Use pnpm test:vercel to run these tests.
import { Sandbox } from "@vercel/sandbox";
import type { ToolExecutionOptions } from "ai";
import { afterAll, assert, beforeAll, describe, expect, it } from "vitest";
import { createBashTool } from "./tool.js";
import type { CommandResult } from "./types.js";

// AI SDK tool execute requires (args, options) - we provide test options
const opts: ToolExecutionOptions = { toolCallId: "test", messages: [] };

/** Generate a unique test directory to avoid race conditions between tests */
function uniqueDir(): string {
  return `/vercel/sandbox/test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Integration tests that verify createBashTool works correctly
 * with the real @vercel/sandbox environment.
 *
 * These tests require Vercel OIDC authentication.
 * Run with: pnpm test:vercel
 *
 * Note: createBashTool automatically uses /vercel/sandbox/workspace as the default
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
    console.log("Creating sandbox");
    vercelSandbox = await Sandbox.create();
    console.log("Sandbox created");
  }, 10000);

  afterAll(async () => {
    if (vercelSandbox) {
      await vercelSandbox.stop();
    }
  });

  describe("ls command", () => {
    it("ls -la lists files with details", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
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
    }, 10000);

    it("ls lists directory contents", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "ls src" },
        opts,
      )) as CommandResult;

      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("index.ts\nutils");
    }, 10000);
  });

  describe("find command", () => {
    it(`find . -name '*.ts' finds TypeScript files`, async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "find . -name '*.ts'" },
        opts,
      )) as CommandResult;

      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("helpers.ts");
      expect(result.stdout).toContain("format.ts");
      expect(result.stdout).not.toContain("package.json");
    }, 10000);

    it(`find . -name '*.json' finds JSON files`, async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "find . -name '*.json'" },
        opts,
      )) as CommandResult;
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("./package.json\n");
    }, 10000);
  });

  describe("grep command", () => {
    it("grep -r 'pattern' . searches file contents", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "grep -r 'export' ." },
        opts,
      )) as CommandResult;

      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("index.ts");
      expect(result.stdout).toContain("helpers.ts");
      expect(result.stdout).toContain("format.ts");
    }, 10000);

    it("grep finds specific patterns", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
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
    }, 10000);
  });

  describe("cat command", () => {
    it("cat <file> views file contents", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "cat src/index.ts" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('export const hello = "world";');
    }, 10000);

    it("cat package.json shows JSON content", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
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
    }, 10000);
  });

  describe("working directory", () => {
    it("uses /vercel/sandbox/workspace as default destination", async () => {
      // This test verifies the default destination behavior - no custom destination
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
    }, 10000);

    it("pwd shows custom destination within sandbox", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.bash.execute, "bash.execute should be defined");
      const result = (await tools.bash.execute(
        { command: "pwd" },
        opts,
      )) as CommandResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(dest);
    }, 10000);
  });

  describe("readFile tool", () => {
    it("reads file content correctly", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.readFile.execute, "readFile.execute should be defined");
      const result = (await tools.readFile.execute(
        { path: `${dest}/src/index.ts` },
        opts,
      )) as { content: string };

      expect(result.content).toBe('export const hello = "world";');
    }, 10000);
  });

  describe("writeFile tool", () => {
    it("writes file and can be read back", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: testFiles,
      });

      assert(tools.writeFile.execute, "writeFile.execute should be defined");
      assert(tools.bash.execute, "bash.execute should be defined");

      await tools.writeFile.execute(
        {
          path: "newfile.txt",
          content: "Hello, World!",
        },
        opts,
      );

      const result = (await tools.bash.execute(
        { command: "cat newfile.txt" },
        opts,
      )) as CommandResult;

      expect(result.stdout).toBe("Hello, World!");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }, 10000);
  });

  describe("promptOptions", () => {
    it("uses custom toolPrompt when provided", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
        files: { "data.json": "{}" },
        promptOptions: {
          toolPrompt: "Custom tools: myTool",
        },
      });

      expect(tools.bash.description).toContain("Custom tools: myTool");
      expect(tools.bash.description).not.toContain("Available tools:");
    }, 30000);

    it("disables tool hints with empty string toolPrompt", async () => {
      const dest = uniqueDir();
      const { tools } = await createBashTool({
        sandbox: vercelSandbox,
        destination: dest,
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
