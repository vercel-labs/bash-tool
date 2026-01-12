import { describe, expect, it } from "vitest";
import { isJustBash, wrapJustBash } from "./just-bash.js";
import { isVercelSandbox } from "./vercel.js";

describe("isJustBash", () => {
  it("returns false for null/undefined", () => {
    expect(isJustBash(null)).toBe(false);
    expect(isJustBash(undefined)).toBe(false);
  });

  it("returns false for plain objects", () => {
    expect(isJustBash({})).toBe(false);
    expect(isJustBash({ foo: "bar" })).toBe(false);
  });

  it("returns true for objects with exec function", () => {
    const mockBash = {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    };
    expect(isJustBash(mockBash)).toBe(true);
  });

  it("returns true for real just-bash Bash shape", () => {
    // Shape matching real just-bash Bash class
    const mockBash = {
      exec: async (_cmd: string) => ({ stdout: "", stderr: "", exitCode: 0 }),
      cwd: "/workspace",
      env: {},
      files: {},
    };
    expect(isJustBash(mockBash)).toBe(true);
  });
});

describe("wrapJustBash", () => {
  it("wraps executeCommand", async () => {
    const mockBash = {
      exec: async (cmd: string) => ({
        stdout: `ran: ${cmd}`,
        stderr: "",
        exitCode: 0,
      }),
      fs: {
        readFile: async () => "",
        writeFile: async () => {},
      },
    };

    const sandbox = wrapJustBash(mockBash);
    const result = await sandbox.executeCommand("ls -la");

    expect(result).toEqual({
      stdout: "ran: ls -la",
      stderr: "",
      exitCode: 0,
    });
  });

  it("wraps readFile via fs.readFile", async () => {
    const mockBash = {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      fs: {
        readFile: async (path: string) => `content of ${path}`,
        writeFile: async () => {},
      },
    };

    const sandbox = wrapJustBash(mockBash);
    const content = await sandbox.readFile("/test.txt");

    expect(content).toBe("content of /test.txt");
  });

  it("wraps writeFiles via fs.writeFile", async () => {
    const writtenFiles: Array<{ path: string; content: string }> = [];
    const mockBash = {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      fs: {
        readFile: async () => "",
        writeFile: async (path: string, content: string) => {
          writtenFiles.push({ path, content });
        },
      },
    };

    const sandbox = wrapJustBash(mockBash);
    await sandbox.writeFiles([
      { path: "/dir/test.txt", content: "my content" },
      { path: "/other/file.txt", content: "other content" },
    ]);

    expect(writtenFiles).toEqual([
      { path: "/dir/test.txt", content: "my content" },
      { path: "/other/file.txt", content: "other content" },
    ]);
  });

  it("wraps writeFiles with Buffer content", async () => {
    const writtenFiles: Array<{ path: string; content: string }> = [];
    const mockBash = {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      fs: {
        readFile: async () => "",
        writeFile: async (path: string, content: string) => {
          writtenFiles.push({ path, content });
        },
      },
    };

    const sandbox = wrapJustBash(mockBash);
    await sandbox.writeFiles([
      { path: "/binary.bin", content: Buffer.from("binary data") },
      { path: "/text.txt", content: "string data" },
    ]);

    expect(writtenFiles).toEqual([
      { path: "/binary.bin", content: "binary data" },
      { path: "/text.txt", content: "string data" },
    ]);
  });
});

describe("duck-typing disambiguation", () => {
  it("just-bash instance is not detected as vercel sandbox", () => {
    const mockBash = {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      cwd: "/workspace",
    };

    expect(isJustBash(mockBash)).toBe(true);
    expect(isVercelSandbox(mockBash)).toBe(false);
  });

  it("vercel sandbox is not detected as just-bash", () => {
    const mockVercel = {
      sandboxId: "sbx-123",
      runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      readFile: async () => null,
      writeFiles: async () => {},
      stop: async () => {},
    };

    expect(isVercelSandbox(mockVercel)).toBe(true);
    // Vercel sandbox doesn't have exec method at top level
    expect(isJustBash(mockVercel)).toBe(false);
  });

  it("custom Sandbox implementation is neither just-bash nor vercel", () => {
    const customSandbox = {
      executeCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      readFile: async () => "",
      writeFiles: async () => {},
    };

    expect(isJustBash(customSandbox)).toBe(false);
    expect(isVercelSandbox(customSandbox)).toBe(false);
  });

  it("object with both exec and vercel properties is detected as vercel first", () => {
    // Edge case: object has both signatures
    // In tool.ts, we check vercel first, so this should be vercel
    const ambiguous = {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      sandboxId: "sbx-123",
      runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      readFile: async () => null,
      writeFiles: async () => {},
      stop: async () => {},
    };

    // Both would match
    expect(isJustBash(ambiguous)).toBe(true);
    expect(isVercelSandbox(ambiguous)).toBe(true);
    // But in tool.ts, vercel is checked first - this test documents the behavior
  });
});
