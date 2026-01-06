import type { CommandResult, JustBashInstance, Sandbox } from "../types.js";

/**
 * Options for creating a just-bash sandbox.
 */
export interface JustBashSandboxOptions {
  /** Initial files to populate the virtual filesystem */
  files?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * Creates a Sandbox implementation using just-bash (virtual bash environment).
 * Dynamically imports just-bash to keep it as an optional peer dependency.
 */
export async function createJustBashSandbox(
  options: JustBashSandboxOptions = {},
): Promise<Sandbox> {
  // Dynamic import to handle optional peer dependency
  let Bash: typeof import("just-bash").Bash;
  try {
    const module = await import("just-bash");
    Bash = module.Bash;
  } catch {
    throw new Error(
      'just-bash is not installed. Either install it with "npm install just-bash" or provide your own sandbox via the sandbox option.',
    );
  }

  const bashEnv = new Bash({
    files: options.files,
    cwd: options.cwd,
  });

  return {
    async executeCommand(command: string): Promise<CommandResult> {
      const result = await bashEnv.exec(command);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },

    async readFile(filePath: string): Promise<string> {
      const result = await bashEnv.exec(`cat "${filePath}"`);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${filePath}\n${result.stderr}`);
      }
      return result.stdout;
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      // Ensure parent directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      if (dir) {
        await bashEnv.exec(`mkdir -p "${dir}"`);
      }

      // Write file using heredoc to handle special characters
      const result = await bashEnv.exec(
        `cat > "${filePath}" << 'BASH_TOOL_EOF'\n${content}\nBASH_TOOL_EOF`,
      );

      if (result.exitCode !== 0) {
        throw new Error(`Failed to write file: ${filePath}\n${result.stderr}`);
      }
    },

    async stop(): Promise<void> {
      // just-bash has no cleanup needed
    },
  };
}

/**
 * Check if an object is a just-bash Bash instance using duck-typing.
 */
export function isJustBash(obj: unknown): obj is JustBashInstance {
  if (!obj || typeof obj !== "object") return false;
  const candidate = obj as Record<string, unknown>;
  // just-bash Bash class has an exec method
  return typeof candidate.exec === "function";
}

/**
 * Wraps a just-bash Bash instance to conform to our Sandbox interface.
 */
export function wrapJustBash(bashInstance: JustBashInstance): Sandbox {
  return {
    async executeCommand(command: string): Promise<CommandResult> {
      const result = await bashInstance.exec(command);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },

    async readFile(filePath: string): Promise<string> {
      const result = await bashInstance.exec(`cat "${filePath}"`);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${filePath}\n${result.stderr}`);
      }
      return result.stdout;
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      // Ensure parent directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      if (dir) {
        await bashInstance.exec(`mkdir -p "${dir}"`);
      }

      // Write file using heredoc to handle special characters
      const result = await bashInstance.exec(
        `cat > "${filePath}" << 'BASH_TOOL_EOF'\n${content}\nBASH_TOOL_EOF`,
      );

      if (result.exitCode !== 0) {
        throw new Error(`Failed to write file: ${filePath}\n${result.stderr}`);
      }
    },

    async stop(): Promise<void> {
      // just-bash has no cleanup needed
    },
  };
}
