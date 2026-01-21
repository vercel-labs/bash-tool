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
        // Use actual built types for bash-tool, stubs for external packages
        "bash-tool": [join(REPO_ROOT, "dist/index.d.ts")],
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
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
  };
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

    if (code.includes("createBashTool") || code.includes("createSkillTool")) {
      // Build bash-tool import based on what's used
      const imports: string[] = [];
      if (code.includes("createBashTool")) {
        imports.push("createBashTool");
      }
      if (code.includes("createSkillTool")) {
        imports.push("experimental_createSkillTool as createSkillTool");
      }
      if (code.includes('from "bash-tool"') && code.includes("Sandbox")) {
        imports.push("Sandbox");
      }
      assumedImports.push(`import { ${imports.join(", ")} } from "bash-tool";`);
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

    // Strip existing imports from the code (handles multi-line imports)
    const codeWithoutImports = code.replace(
      /^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm,
      "",
    );

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
