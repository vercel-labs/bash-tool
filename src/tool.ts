import path from "node:path";
import { getFilePaths, streamFiles } from "./files/loader.js";
import {
  createJustBashSandbox,
  isJustBash,
  wrapJustBash,
} from "./sandbox/just-bash.js";
import { isVercelSandbox, wrapVercelSandbox } from "./sandbox/vercel.js";
import { createBashExecuteTool } from "./tools/bash.js";
import { createReadFileTool } from "./tools/read-file.js";
import { createWriteFileTool } from "./tools/write-file.js";
import { createToolPrompt } from "./tools-prompt.js";
import type {
  BashToolkit,
  CreateBashToolOptions,
  Sandbox,
  SandboxInstance,
  SandboxProvider,
} from "./types.js";

const DEFAULT_DESTINATION = "/workspace";
const VERCEL_SANDBOX_DESTINATION = "/vercel/sandbox/workspace";
const WRITE_BATCH_SIZE = 20;
const DEFAULT_MAX_FILES = 1000;

function isSandboxProvider(
  sandbox: CreateBashToolOptions["sandbox"],
): sandbox is SandboxProvider {
  return typeof sandbox === "function";
}

function normalizeSandbox(sandbox: SandboxInstance): {
  sandbox: Sandbox;
  usingJustBash: boolean;
} {
  if (isVercelSandbox(sandbox)) {
    return { sandbox: wrapVercelSandbox(sandbox), usingJustBash: false };
  }

  if (isJustBash(sandbox)) {
    return { sandbox: wrapJustBash(sandbox), usingJustBash: true };
  }

  return { sandbox: sandbox as Sandbox, usingJustBash: false };
}

async function writeFilesToSandbox(options: {
  sandbox: Sandbox;
  destination: string;
  files: CreateBashToolOptions["files"];
  uploadDirectory: CreateBashToolOptions["uploadDirectory"];
}): Promise<void> {
  const { sandbox, destination, files, uploadDirectory } = options;
  let batch: Array<{ path: string; content: Buffer }> = [];

  for await (const file of streamFiles({ files, uploadDirectory })) {
    batch.push({
      path: path.posix.join(destination, file.path),
      content: file.content,
    });

    if (batch.length >= WRITE_BATCH_SIZE) {
      await sandbox.writeFiles(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await sandbox.writeFiles(batch);
  }
}

/**
 * Creates a bash tool with tools for AI agents.
 *
 * @example
 * ```typescript
 * // Simple usage with inline files
 * const { tools, sandbox } = await createBashTool({
 *   files: { "src/index.ts": "export const x = 1;" },
 * });
 *
 * // Upload a directory from disk
 * const { tools, sandbox } = await createBashTool({
 *   uploadDirectory: { source: "./my-project" },
 * });
 *
 * // Use with AI SDK
 * const result = await generateText({
 *   model,
 *   tools,
 *   prompt: "List all TypeScript files",
 * });
 *
 * // Cleanup
 * await sandbox.stop();
 * ```
 */
export async function createBashTool(
  options: CreateBashToolOptions = {},
): Promise<BashToolkit> {
  const lazySandboxProvider = isSandboxProvider(options.sandbox)
    ? options.sandbox
    : undefined;

  // Determine default destination based on sandbox type
  const defaultDestination =
    options.sandbox && !lazySandboxProvider && isVercelSandbox(options.sandbox)
      ? VERCEL_SANDBOX_DESTINATION
      : DEFAULT_DESTINATION;
  const destination = options.destination ?? defaultDestination;

  // 3. Create or wrap sandbox
  let sandbox: Sandbox;
  let usingJustBash = false;
  let fileList: string[] = [];
  let workingDir = destination;

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  let fileWrittenPromise: Promise<void> | undefined;

  if (lazySandboxProvider) {
    fileList = await getFilePaths({
      files: options.files,
      uploadDirectory: options.uploadDirectory,
    });

    if (maxFiles > 0 && fileList.length > maxFiles) {
      throw new Error(
        `Too many files to upload: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
          `Either increase maxFiles, use a more restrictive include pattern in uploadDirectory, ` +
          `or write files to the sandbox yourself before calling createBashTool.`,
      );
    }

    let sandboxPromise: Promise<Sandbox> | undefined;
    const getSandbox = (): Promise<Sandbox> => {
      sandboxPromise ??= (async () => {
        const resolved = normalizeSandbox(await lazySandboxProvider());
        await writeFilesToSandbox({
          sandbox: resolved.sandbox,
          destination,
          files: options.files,
          uploadDirectory: options.uploadDirectory,
        });
        return resolved.sandbox;
      })();
      return sandboxPromise;
    };

    sandbox = {
      async executeCommand(command) {
        return (await getSandbox()).executeCommand(command);
      },
      async readFile(filePath) {
        return (await getSandbox()).readFile(filePath);
      },
      async writeFiles(files) {
        return (await getSandbox()).writeFiles(files);
      },
    };
  } else if (options.sandbox && !isSandboxProvider(options.sandbox)) {
    // External sandbox provided - stream files and write in batches
    const normalized = normalizeSandbox(options.sandbox);
    sandbox = normalized.sandbox;
    usingJustBash = normalized.usingJustBash;

    // Get file paths for tool prompt (without loading content)
    fileList = await getFilePaths({
      files: options.files,
      uploadDirectory: options.uploadDirectory,
    });

    // Check file limit
    if (maxFiles > 0 && fileList.length > maxFiles) {
      throw new Error(
        `Too many files to upload: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
          `Either increase maxFiles, use a more restrictive include pattern in uploadDirectory, ` +
          `or write files to the sandbox yourself before calling createBashTool.`,
      );
    }

    // Stream files and write in batches to avoid memory issues
    fileWrittenPromise = writeFilesToSandbox({
      sandbox,
      destination,
      files: options.files,
      uploadDirectory: options.uploadDirectory,
    });
  } else {
    // No external sandbox - use just-bash
    usingJustBash = true;

    if (options.uploadDirectory && !options.files) {
      // Use OverlayFs for uploadDirectory (avoids loading all files into memory)
      const overlayRoot = path.resolve(options.uploadDirectory.source);
      const result = await createJustBashSandbox({
        overlayRoot,
      });
      sandbox = result;

      // Get file paths without loading content (for tool prompt)
      fileList = await getFilePaths({
        uploadDirectory: options.uploadDirectory,
      });

      // Check file limit (even for OverlayFs, we list files for the tool prompt)
      if (maxFiles > 0 && fileList.length > maxFiles) {
        throw new Error(
          `Too many files: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
            `Either increase maxFiles or use a more restrictive include pattern in uploadDirectory.`,
        );
      }

      // Use the OverlayFs mount point as working directory
      if (result.mountPoint) {
        workingDir = result.mountPoint;
      }
    } else {
      // Load files into memory for in-memory filesystem
      // For just-bash we need all files upfront, but stream to avoid peak memory
      const filesWithDestination: Record<string, string> = {};

      for await (const file of streamFiles({
        files: options.files,
        uploadDirectory: options.uploadDirectory,
      })) {
        const absolutePath = path.posix.join(destination, file.path);
        filesWithDestination[absolutePath] = file.content.toString("utf-8");
      }

      fileList = await getFilePaths({
        files: options.files,
        uploadDirectory: options.uploadDirectory,
      });

      // Check file limit
      if (maxFiles > 0 && fileList.length > maxFiles) {
        throw new Error(
          `Too many files to load: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
            `Either increase maxFiles, use a more restrictive include pattern in uploadDirectory, ` +
            `or provide your own sandbox with files already written.`,
        );
      }

      sandbox = await createJustBashSandbox({
        files: filesWithDestination,
        cwd: destination,
      });
    }
  }

  // 4. Discover available tools and generate prompt
  const [toolPrompt, _] = await Promise.all([
    createToolPrompt({
      sandbox,
      filenames: fileList,
      isJustBash: usingJustBash,
      toolPrompt: lazySandboxProvider
        ? (options.promptOptions?.toolPrompt ?? "")
        : options.promptOptions?.toolPrompt,
    }),
    fileWrittenPromise,
  ]);

  // 5. Create tools
  const bash = createBashExecuteTool({
    sandbox,
    cwd: workingDir,
    files: fileList,
    toolPrompt,
    extraInstructions: options.extraInstructions,
    onBeforeBashCall: options.onBeforeBashCall,
    onAfterBashCall: options.onAfterBashCall,
    maxOutputLength: options.maxOutputLength,
    experimentalTeeTransform: options.experimentalTeeTransform,
  });

  const tools = {
    bash,
    readFile: createReadFileTool({ sandbox, cwd: workingDir }),
    writeFile: createWriteFileTool({ sandbox, cwd: workingDir }),
  };

  return { bash, tools, sandbox };
}
