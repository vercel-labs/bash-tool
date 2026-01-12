import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFilePaths, streamFiles } from "./loader.js";

/** Helper to collect all files from the async generator */
async function collectFiles(
  options: Parameters<typeof streamFiles>[0],
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for await (const file of streamFiles(options)) {
    files[file.path] = file.content.toString();
  }
  return files;
}

describe("streamFiles", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bash-tool-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("yields nothing with no options", async () => {
    const files = await collectFiles({});
    expect(files).toEqual({});
  });

  it("yields inline files as Buffer", async () => {
    const files = await collectFiles({
      files: {
        "src/index.ts": "export const x = 1;",
        "package.json": "{}",
      },
    });

    expect(files["src/index.ts"]).toBe("export const x = 1;");
    expect(files["package.json"]).toBe("{}");
  });

  it("streams directory contents", async () => {
    // Create test files
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src/index.ts"),
      "export const x = 1;",
    );
    await fs.writeFile(path.join(tempDir, "package.json"), '{"name": "test"}');

    const files = await collectFiles({
      uploadDirectory: { source: tempDir },
    });

    expect(files["src/index.ts"]).toBe("export const x = 1;");
    expect(files["package.json"]).toBe('{"name": "test"}');
  });

  it("filters with include glob", async () => {
    // Create test files
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "src/index.ts"), "typescript");
    await fs.writeFile(path.join(tempDir, "src/style.css"), "css");
    await fs.writeFile(path.join(tempDir, "readme.md"), "markdown");

    const files = await collectFiles({
      uploadDirectory: {
        source: tempDir,
        include: "**/*.ts",
      },
    });

    expect(Object.keys(files)).toEqual(["src/index.ts"]);
    expect(files["src/index.ts"]).toBe("typescript");
  });

  it("inline files take precedence over directory files", async () => {
    // Create test file
    await fs.writeFile(path.join(tempDir, "config.json"), '{"original": true}');
    await fs.writeFile(path.join(tempDir, "data.txt"), "from disk");

    const files = await collectFiles({
      uploadDirectory: { source: tempDir },
      files: {
        "config.json": '{"overridden": true}',
        "new-file.txt": "only inline",
      },
    });

    expect(files["config.json"]).toBe('{"overridden": true}');
    expect(files["data.txt"]).toBe("from disk");
    expect(files["new-file.txt"]).toBe("only inline");
  });

  it("ignores node_modules and .git by default", async () => {
    // Create test files
    await fs.mkdir(path.join(tempDir, "node_modules/pkg"), { recursive: true });
    await fs.mkdir(path.join(tempDir, ".git/objects"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "index.ts"), "source");
    await fs.writeFile(
      path.join(tempDir, "node_modules/pkg/index.js"),
      "module",
    );
    await fs.writeFile(path.join(tempDir, ".git/objects/abc"), "git object");

    const files = await collectFiles({
      uploadDirectory: { source: tempDir },
    });

    expect(Object.keys(files)).toEqual(["index.ts"]);
  });
});

describe("getFilePaths", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bash-tool-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty array with no options", async () => {
    const paths = await getFilePaths({});
    expect(paths).toEqual([]);
  });

  it("returns inline file paths", async () => {
    const paths = await getFilePaths({
      files: { "a.txt": "a", "b.txt": "b" },
    });
    expect(paths).toContain("a.txt");
    expect(paths).toContain("b.txt");
  });

  it("returns directory file paths", async () => {
    await fs.writeFile(path.join(tempDir, "file1.ts"), "1");
    await fs.writeFile(path.join(tempDir, "file2.ts"), "2");

    const paths = await getFilePaths({
      uploadDirectory: { source: tempDir },
    });

    expect(paths).toContain("file1.ts");
    expect(paths).toContain("file2.ts");
  });
});
