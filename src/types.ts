import type { Sandbox as VercelSandbox } from "@vercel/sandbox";

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

/**
 * Input for onBeforeBashCall callback.
 */
export interface BeforeBashCallInput {
  /** The command that will be executed */
  command: string;
}

/**
 * Output from onBeforeBashCall callback.
 * Return undefined or the original input to proceed unchanged.
 */
export interface BeforeBashCallOutput {
  /** The (potentially modified) command to execute */
  command: string;
}

/**
 * Input for onAfterBashCall callback.
 */
export interface AfterBashCallInput {
  /** The command that was executed */
  command: string;
  /** The result from executing the command */
  result: CommandResult;
}

/**
 * Output from onAfterBashCall callback.
 * Return undefined or the original result to proceed unchanged.
 */
export interface AfterBashCallOutput {
  /** The (potentially modified) result */
  result: CommandResult;
}

/**
 * Options for customizing the tool prompt generation.
 */
export interface PromptOptions {
  /**
   * Custom tool prompt to use instead of auto-generating one.
   * When provided, skips tool discovery entirely.
   */
  toolPrompt?: string;
}

export interface CreateBashToolOptions {
  /**
   * Destination directory on the sandbox for files.
   * Both `files` and `uploadDirectory` are written relative to this.
   * Also used as the working directory for commands.
   * @default "./workspace"
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
  sandbox?: Sandbox | VercelSandbox | JustBashInstance;

  /**
   * Additional instructions to append to tool descriptions.
   */
  extraInstructions?: string;

  /**
   * Options for customizing the tool prompt generation.
   */
  promptOptions?: PromptOptions;

  /**
   * Callback invoked before bash command execution.
   * Can modify the command before it runs.
   *
   * @example
   * ```typescript
   * onBeforeBashCall: ({ command }) => {
   *   console.log("Running:", command);
   *   // Optionally modify the command
   *   return { command: command.replace(/rm -rf/, "echo 'blocked:'") };
   * }
   * ```
   */
  onBeforeBashCall?: (
    input: BeforeBashCallInput,
  ) => BeforeBashCallOutput | undefined;

  /**
   * Callback invoked after bash command execution.
   * Can modify the result before it's returned.
   *
   * @example
   * ```typescript
   * onAfterBashCall: ({ command, result }) => {
   *   console.log(`Command "${command}" exited with code ${result.exitCode}`);
   *   // Optionally modify the result
   *   return { result: { ...result, stdout: result.stdout.trim() } };
   * }
   * ```
   */
  onAfterBashCall?: (
    input: AfterBashCallInput,
  ) => AfterBashCallOutput | undefined;
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
 * Re-export @vercel/sandbox Sandbox type for convenience.
 */
export type { Sandbox as VercelSandboxInstance } from "@vercel/sandbox";
