import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  isVercelSandbox,
  type VercelSandboxLike,
  wrapVercelSandbox,
} from "./vercel.js";

describe("isVercelSandbox", () => {
  it("returns false for null/undefined", () => {
    expect(isVercelSandbox(null)).toBe(false);
    expect(isVercelSandbox(undefined)).toBe(false);
  });

  it("returns false for plain objects", () => {
    expect(isVercelSandbox({})).toBe(false);
    expect(isVercelSandbox({ foo: "bar" })).toBe(false);
  });

  it("returns false for objects missing required properties", () => {
    expect(isVercelSandbox({ sandboxId: "123" })).toBe(false);
    expect(isVercelSandbox({ sandboxId: "123", runCommand: () => {} })).toBe(
      false,
    );
  });

  it("returns true for objects matching @vercel/sandbox shape", () => {
    const mockVercelSandbox = {
      sandboxId: "sbx-123",
      runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      readFile: async () => null,
      writeFiles: async () => {},
      stop: async () => {},
    };
    expect(isVercelSandbox(mockVercelSandbox)).toBe(true);
  });
});

describe("wrapVercelSandbox", () => {
  it("wraps executeCommand using runCommand", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: vi.fn().mockResolvedValue("output"),
      stderr: vi.fn().mockResolvedValue(""),
    });

    const mockVercelSandbox: VercelSandboxLike = {
      sandboxId: "sbx-123",
      runCommand: mockRunCommand,
      readFile: vi.fn(),
      writeFiles: vi.fn(),
    };

    const sandbox = wrapVercelSandbox(mockVercelSandbox);
    const result = await sandbox.executeCommand("ls -la");

    expect(mockRunCommand).toHaveBeenCalledWith("bash", ["-c", "ls -la"]);
    expect(result).toEqual({ stdout: "output", stderr: "", exitCode: 0 });
  });

  it("wraps readFile and converts stream to string", async () => {
    const mockStream = Readable.from(["file ", "content"]);
    const mockReadFile = vi.fn().mockResolvedValue(mockStream);

    const mockVercelSandbox: VercelSandboxLike = {
      sandboxId: "sbx-123",
      runCommand: vi.fn(),
      readFile: mockReadFile,
      writeFiles: vi.fn(),
    };

    const sandbox = wrapVercelSandbox(mockVercelSandbox);
    const content = await sandbox.readFile("/test.txt");

    expect(mockReadFile).toHaveBeenCalledWith({ path: "/test.txt" });
    expect(content).toBe("file content");
  });

  it("throws on readFile when file not found", async () => {
    const mockReadFile = vi.fn().mockResolvedValue(null);

    const mockVercelSandbox: VercelSandboxLike = {
      sandboxId: "sbx-123",
      runCommand: vi.fn(),
      readFile: mockReadFile,
      writeFiles: vi.fn(),
    };

    const sandbox = wrapVercelSandbox(mockVercelSandbox);
    await expect(sandbox.readFile("/missing.txt")).rejects.toThrow(
      "File not found",
    );
  });

  it("wraps writeFiles using native writeFiles with Buffer", async () => {
    const mockWriteFiles = vi.fn().mockResolvedValue(undefined);

    const mockVercelSandbox: VercelSandboxLike = {
      sandboxId: "sbx-123",
      runCommand: vi.fn(),
      readFile: vi.fn(),
      writeFiles: mockWriteFiles,
    };

    const sandbox = wrapVercelSandbox(mockVercelSandbox);
    await sandbox.writeFiles([
      { path: "/test.txt", content: "content" },
      { path: "/other.txt", content: "other" },
    ]);

    expect(mockWriteFiles).toHaveBeenCalledWith([
      { path: "/test.txt", content: Buffer.from("content", "utf-8") },
      { path: "/other.txt", content: Buffer.from("other", "utf-8") },
    ]);
  });

  it("passes through Buffer content without re-encoding", async () => {
    const mockWriteFiles = vi.fn().mockResolvedValue(undefined);

    const mockVercelSandbox: VercelSandboxLike = {
      sandboxId: "sbx-123",
      runCommand: vi.fn(),
      readFile: vi.fn(),
      writeFiles: mockWriteFiles,
    };

    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const sandbox = wrapVercelSandbox(mockVercelSandbox);
    await sandbox.writeFiles([
      { path: "/image.png", content: binaryContent },
      { path: "/text.txt", content: "string" },
    ]);

    expect(mockWriteFiles).toHaveBeenCalledWith([
      { path: "/image.png", content: binaryContent },
      { path: "/text.txt", content: Buffer.from("string") },
    ]);
  });
});
