/**
 * Tests that code examples in README.md and AGENTS.npm.md are valid TypeScript.
 *
 * This ensures documentation stays in sync with the actual API.
 */

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");

/**
 * Extract TypeScript code blocks from markdown content.
 */
function extractTypeScriptBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:typescript|ts)\n([\s\S]*?)```/g;
  let match = regex.exec(markdown);

  while (match !== null) {
    blocks.push(match[1].trim());
    match = regex.exec(markdown);
  }

  return blocks;
}

/**
 * Create a temporary directory with proper tsconfig and package setup
 * to type-check the code blocks.
 */
function createTempProject(codeBlocks: string[]): string {
  const tempDir = mkdtempSync(join(tmpdir(), "readme-test-"));

  // Create tsconfig.json - only includes temp files, not project source
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      esModuleInterop: true,
      strict: false, // Relaxed for documentation examples
      skipLibCheck: true,
      noEmit: true,
      lib: ["ES2022"],
      typeRoots: [join(REPO_ROOT, "node_modules/@types")],
      paths: {
        // Use .d.ts stubs to avoid pulling in full source
        "bash-tool": [join(tempDir, "bash-tool.d.ts")],
        ai: [join(tempDir, "ai.d.ts")],
        "@vercel/sandbox": [join(tempDir, "vercel-sandbox.d.ts")],
        "just-bash": [join(tempDir, "just-bash.d.ts")],
      },
    },
    include: [`${tempDir}/block-*.ts`],
  };

  writeFileSync(
    join(tempDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
  );

  // Create stub for bash-tool
  writeFileSync(
    join(tempDir, "bash-tool.d.ts"),
    `
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface Sandbox {
  executeCommand(command: string): Promise<CommandResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

export interface BeforeBashCallInput {
  command: string;
}

export interface BeforeBashCallOutput {
  command: string;
}

export interface AfterBashCallInput {
  command: string;
  result: CommandResult;
}

export interface AfterBashCallOutput {
  result: CommandResult;
}

export interface CreateBashToolOptions {
  destination?: string;
  files?: Record<string, string>;
  uploadDirectory?: { source: string; include?: string };
  sandbox?: any;
  extraInstructions?: string;
  onBeforeBashCall?: (input: BeforeBashCallInput) => BeforeBashCallOutput | undefined | void;
  onAfterBashCall?: (input: AfterBashCallInput) => AfterBashCallOutput | undefined | void;
}

export interface BashToolkit {
  bash: any;
  tools: Record<string, any>;
  sandbox: Sandbox;
}

export function createBashTool(options?: CreateBashToolOptions): Promise<BashToolkit>;
`,
  );

  // Create stub for ai
  writeFileSync(
    join(tempDir, "ai.d.ts"),
    `
export interface LanguageModel {}

export type StopCondition<T> = any;

export function stepCountIs(count: number): StopCondition<any>;

export class ToolLoopAgent<T = any> {
  constructor(opts: {
    model: LanguageModel;
    tools?: Record<string, any>;
    stopWhen?: StopCondition<T> | StopCondition<T>[];
  });
  generate(opts: { prompt: string }): Promise<{ text: string }>;
}
`,
  );

  // Create stub for @vercel/sandbox
  writeFileSync(
    join(tempDir, "vercel-sandbox.d.ts"),
    `
export class Sandbox {
  sandboxId: string;
  static create(): Promise<Sandbox>;
  static get(opts: { sandboxId: string }): Promise<Sandbox>;
  stop(): Promise<void>;
}
`,
  );

  // Create stub for just-bash
  writeFileSync(
    join(tempDir, "just-bash.d.ts"),
    `
export class Bash {
  constructor(opts?: { cwd?: string });
}
`,
  );

  // Write each code block as a separate file with assumed imports
  codeBlocks.forEach((code, index) => {
    // Skip bash/shell code blocks
    if (
      code.startsWith("npm ") ||
      code.startsWith("cat ") ||
      code.startsWith("grep ") ||
      code.startsWith("#")
    ) {
      return;
    }

    // Build assumed imports based on what the code block uses
    const assumedImports: string[] = [];

    if (code.includes("createBashTool")) {
      // Check if code imports Sandbox from bash-tool (for custom implementation)
      if (code.includes('from "bash-tool"') && code.includes("Sandbox")) {
        assumedImports.push(
          'import { createBashTool, Sandbox } from "bash-tool";',
        );
      } else {
        assumedImports.push('import { createBashTool } from "bash-tool";');
      }
    }
    if (code.includes("ToolLoopAgent") || code.includes("stepCountIs")) {
      assumedImports.push('import { ToolLoopAgent, stepCountIs } from "ai";');
    }
    if (code.includes("LanguageModel")) {
      assumedImports.push('import type { LanguageModel } from "ai";');
    }
    if (
      code.includes("@vercel/sandbox") ||
      (code.includes("Sandbox.") && !code.includes("BashToolSandbox"))
    ) {
      assumedImports.push('import { Sandbox } from "@vercel/sandbox";');
    }
    if (code.includes("just-bash") || code.includes("new Bash")) {
      assumedImports.push('import { Bash } from "just-bash";');
    }

    // Assumed variable declarations
    const assumedDeclarations = `
declare const yourModel: any;
declare const model: any;
`;

    // Strip existing imports from the code
    const codeWithoutImports = code
      .split("\n")
      .filter((line) => !line.trim().startsWith("import "))
      .join("\n");

    // Wrap code in async IIFE to allow top-level await and isolate scope
    const wrappedCode = `
${assumedImports.join("\n")}
${assumedDeclarations}

// Wrapped in async IIFE for top-level await support
(async () => {
${codeWithoutImports}
})();

export {};
`;

    writeFileSync(join(tempDir, `block-${index}.ts`), wrappedCode);
  });

  return tempDir;
}

describe("README.md code examples", () => {
  const readmePath = join(REPO_ROOT, "README.md");

  it("should contain valid TypeScript that type-checks", () => {
    const readme = readFileSync(readmePath, "utf-8");
    const codeBlocks = extractTypeScriptBlocks(readme);
    expect(codeBlocks.length).toBeGreaterThan(0);

    const tempDir = createTempProject(codeBlocks);

    try {
      execSync(`pnpm exec tsc --project ${tempDir}/tsconfig.json --noEmit`, {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      const output = execError.stdout || execError.stderr || String(error);
      rmSync(tempDir, { recursive: true, force: true });

      expect.fail(
        `README.md TypeScript code blocks failed type-checking:\n\n${output}`,
      );
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should have createBashTool and ToolLoopAgent examples", () => {
    const readme = readFileSync(readmePath, "utf-8");
    const codeBlocks = extractTypeScriptBlocks(readme);

    const hasCreateBashTool = codeBlocks.some((block) =>
      block.includes("createBashTool"),
    );
    const hasToolLoopAgent = codeBlocks.some((block) =>
      block.includes("ToolLoopAgent"),
    );

    expect(hasCreateBashTool, "README should have createBashTool example").toBe(
      true,
    );
    expect(hasToolLoopAgent, "README should have ToolLoopAgent example").toBe(
      true,
    );
  });
});

describe("AGENTS.npm.md code examples", () => {
  const agentsPath = join(REPO_ROOT, "AGENTS.npm.md");

  it("should contain valid TypeScript that type-checks", () => {
    const agents = readFileSync(agentsPath, "utf-8");
    const codeBlocks = extractTypeScriptBlocks(agents);
    expect(codeBlocks.length).toBeGreaterThan(0);

    const tempDir = createTempProject(codeBlocks);

    try {
      execSync(`pnpm exec tsc --project ${tempDir}/tsconfig.json --noEmit`, {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      const output = execError.stdout || execError.stderr || String(error);
      rmSync(tempDir, { recursive: true, force: true });

      expect.fail(
        `AGENTS.npm.md TypeScript code blocks failed type-checking:\n\n${output}`,
      );
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should have Quick Reference and Common Patterns examples", () => {
    const agents = readFileSync(agentsPath, "utf-8");
    const codeBlocks = extractTypeScriptBlocks(agents);

    const hasCreateBashTool = codeBlocks.some((block) =>
      block.includes("createBashTool"),
    );
    const hasToolLoopAgent = codeBlocks.some((block) =>
      block.includes("ToolLoopAgent"),
    );

    expect(
      hasCreateBashTool,
      "AGENTS.npm.md should have createBashTool example",
    ).toBe(true);
    expect(
      hasToolLoopAgent,
      "AGENTS.npm.md should have ToolLoopAgent example",
    ).toBe(true);
  });
});
