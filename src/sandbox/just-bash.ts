import type { CommandResult, Sandbox } from "../types.js";

/**
 * Minimal interface for the just-bash methods we actually use.
 * This allows proper typing without requiring the full class.
 */
export interface JustBashLike {
  exec: (command: string) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
}

/**
 * Options for creating a just-bash sandbox.
 */
export interface JustBashSandboxOptions {
  /** Initial files to populate the virtual filesystem */
  files?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /**
   * Use OverlayFs with this directory as root.
   * Reads come from disk, writes stay in memory.
   * When provided, `files` is ignored.
   */
  overlayRoot?: string;
}

/**
 * Creates a Sandbox implementation using just-bash (virtual bash environment).
 * Dynamically imports just-bash to keep it as an optional peer dependency.
 *
 * When `overlayRoot` is provided, uses OverlayFs for copy-on-write over a real directory.
 * This avoids loading all files into memory - reads come from disk, writes stay in memory.
 */
export async function createJustBashSandbox(
  options: JustBashSandboxOptions = {},
): Promise<Sandbox & { mountPoint?: string }> {
  // Dynamic import to handle optional peer dependency
  let Bash: typeof import("just-bash").Bash;
  let OverlayFs: typeof import("just-bash").OverlayFs | undefined;
  let nodePath: typeof import("node:path");

  try {
    const module = await import("just-bash");
    Bash = module.Bash;
    OverlayFs = module.OverlayFs;
    nodePath = await import("node:path");
  } catch {
    throw new Error(
      'just-bash is not installed. Either install it with "npm install just-bash" or provide your own sandbox via the sandbox option.',
    );
  }

  let bashEnv: InstanceType<typeof Bash>;
  let mountPoint: string | undefined;

  if (options.overlayRoot && OverlayFs) {
    // Use OverlayFs for copy-on-write over a real directory
    // Resolve to absolute path for OverlayFs
    const absoluteRoot = nodePath.resolve(options.overlayRoot);
    const overlay = new OverlayFs({ root: absoluteRoot });
    mountPoint = overlay.getMountPoint();
    bashEnv = new Bash({
      fs: overlay,
      cwd: options.cwd ?? mountPoint,
    });
  } else {
    // Use in-memory filesystem with provided files
    bashEnv = new Bash({
      files: options.files,
      cwd: options.cwd,
    });
  }

  return {
    mountPoint,

    async executeCommand(command: string): Promise<CommandResult> {
      const result = await bashEnv.exec(command);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },

    async readFile(filePath: string): Promise<string> {
      return bashEnv.fs.readFile(filePath);
    },

    async writeFiles(
      files: Array<{ path: string; content: string | Buffer }>,
    ): Promise<void> {
      for (const file of files) {
        const content =
          typeof file.content === "string"
            ? file.content
            : file.content.toString("utf-8");
        await bashEnv.fs.writeFile(file.path, content);
      }
    },
  };
}

/**
 * Check if an object is a just-bash Bash instance using duck-typing.
 */
export function isJustBash(obj: unknown): obj is JustBashLike {
  if (!obj || typeof obj !== "object") return false;
  const candidate = obj as Record<string, unknown>;
  // just-bash Bash class has an exec method
  return typeof candidate.exec === "function";
}

/**
 * Wraps a just-bash Bash instance to conform to our Sandbox interface.
 */
export function wrapJustBash(bashInstance: JustBashLike): Sandbox {
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
      return bashInstance.fs.readFile(filePath);
    },

    async writeFiles(
      files: Array<{ path: string; content: string | Buffer }>,
    ): Promise<void> {
      for (const file of files) {
        const content =
          typeof file.content === "string"
            ? file.content
            : file.content.toString("utf-8");
        await bashInstance.fs.writeFile(file.path, content);
      }
    },
  };
}
