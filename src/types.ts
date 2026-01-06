export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface Sandbox {
  executeCommand(command: string): Promise<CommandResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateBashToolOptions {
  /**
   * Destination directory on the sandbox for files.
   * Both `files` and `uploadDirectory` are written relative to this.
   * Also used as the working directory for commands.
   * @default "/workspace"
   */
  destination?: string;

  /**
   * Inline files to write to the sandbox.
   * Keys are relative paths within `destination`.
   * @example { "src/index.ts": "export const x = 1;" }
   */
  files?: Record<string, string>;

  /**
   * Upload a directory from disk to the sandbox.
   */
  uploadDirectory?: {
    /** Path on disk (local machine) */
    source: string;
    /**
     * Glob pattern to filter files.
     * @default "**\/*"
     */
    include?: string;
  };

  /**
   * Override the default just-bash sandbox.
   * Accepts a @vercel/sandbox instance, just-bash Bash instance,
   * or any object implementing Sandbox.
   */
  sandbox?: Sandbox | VercelSandboxInstance | JustBashInstance;

  /**
   * Additional instructions to append to tool descriptions.
   */
  extraInstructions?: string;

  /**
   * Callback invoked before each tool execution.
   */
  onCall?: (toolName: string, args: unknown) => void;
}

// Import actual tool creators for proper typing
import type { createBashExecuteTool } from "./tools/bash.js";
import type { createReadFileTool } from "./tools/read-file.js";
import type { createWriteFileTool } from "./tools/write-file.js";

export interface BashToolkit {
  /** The bash tool for direct use */
  bash: ReturnType<typeof createBashExecuteTool>;
  /** All tools (bash, readFile, writeFile) for passing to AI SDK */
  tools: {
    bash: ReturnType<typeof createBashExecuteTool>;
    readFile: ReturnType<typeof createReadFileTool>;
    writeFile: ReturnType<typeof createWriteFileTool>;
  };
  sandbox: Sandbox;
}

/**
 * Duck-typed @vercel/sandbox instance.
 * We detect this by checking for characteristic properties.
 */
export interface VercelSandboxInstance {
  shells?: unknown;
  kill?: () => Promise<void>;
  [key: string]: unknown;
}

/**
 * Duck-typed just-bash Bash instance.
 * We detect this by checking for the exec method.
 */
export interface JustBashInstance {
  exec: (command: string) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
  [key: string]: unknown;
}
