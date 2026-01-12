import type { CommandResult, Sandbox } from "../types.js";

/**
 * Minimal interface for the @vercel/sandbox methods we actually use.
 * This allows proper typing without requiring the full class.
 */
export interface VercelSandboxLike {
  sandboxId: string;
  runCommand: (
    command: string,
    args?: string[],
  ) => Promise<{
    exitCode: number;
    stdout: (opts?: { signal?: AbortSignal }) => Promise<string>;
    stderr: (opts?: { signal?: AbortSignal }) => Promise<string>;
  }>;
  readFile: (file: { path: string }) => Promise<NodeJS.ReadableStream | null>;
  writeFiles: (files: { path: string; content: Buffer }[]) => Promise<void>;
}

/**
 * Check if an object is a @vercel/sandbox instance using duck-typing.
 */
export function isVercelSandbox(obj: unknown): obj is VercelSandboxLike {
  if (!obj || typeof obj !== "object") return false;
  const candidate = obj as Record<string, unknown>;
  // @vercel/sandbox Sandbox class has these characteristic properties
  return (
    typeof candidate.sandboxId === "string" &&
    typeof candidate.runCommand === "function" &&
    typeof candidate.readFile === "function" &&
    typeof candidate.writeFiles === "function"
  );
}

/**
 * Helper to read a stream into a string.
 */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Wraps a @vercel/sandbox instance to conform to our Sandbox interface.
 */
export function wrapVercelSandbox(vercelSandbox: VercelSandboxLike): Sandbox {
  return {
    async executeCommand(command: string): Promise<CommandResult> {
      const result = await vercelSandbox.runCommand("bash", ["-c", command]);
      const [stdout, stderr] = await Promise.all([
        result.stdout(),
        result.stderr(),
      ]);
      return {
        stdout,
        stderr,
        exitCode: result.exitCode,
      };
    },

    async readFile(filePath: string): Promise<string> {
      const stream = await vercelSandbox.readFile({ path: filePath });
      if (stream === null) {
        throw new Error(`File not found: ${filePath}`);
      }
      return streamToString(stream);
    },

    async writeFiles(
      files: Array<{ path: string; content: string | Buffer }>,
    ): Promise<void> {
      // Convert all content to Buffer (binary) and write
      await vercelSandbox.writeFiles(
        files.map((f) => ({
          path: f.path,
          content: Buffer.isBuffer(f.content)
            ? f.content
            : Buffer.from(f.content),
        })),
      );
    },
  };
}
