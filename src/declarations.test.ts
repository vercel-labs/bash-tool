import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(__dirname, "..");

describe("published declarations", () => {
  it("type-checks without the optional @vercel/sandbox peer", async () => {
    const declarations = await readFile(
      join(repoRoot, "dist/types.d.ts"),
      "utf8",
    );
    expect(declarations).not.toContain('from "@vercel/sandbox"');

    const tempDir = await mkdtemp(join(tmpdir(), "bash-tool-types-"));
    try {
      await writeFile(
        join(tempDir, "consumer.ts"),
        `
import type {
  CreateBashToolOptions,
  VercelSandboxInstance,
} from "bash-tool";

declare const sandbox: VercelSandboxInstance;
const options: CreateBashToolOptions = { sandbox };
void options;
`,
      );
      await writeFile(
        join(tempDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
            skipLibCheck: false,
            typeRoots: [join(repoRoot, "node_modules/@types")],
            paths: {
              "bash-tool": [join(repoRoot, "dist/index.d.ts")],
            },
          },
          include: [join(tempDir, "consumer.ts")],
        }),
      );

      await execFileAsync(
        process.execPath,
        [
          join(repoRoot, "node_modules/typescript/bin/tsc"),
          "--project",
          join(tempDir, "tsconfig.json"),
        ],
        { cwd: repoRoot },
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 30_000);
});
