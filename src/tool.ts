import path from "node:path";
import { loadFiles } from "./files/loader.js";
import {
  createJustBashSandbox,
  isJustBash,
  wrapJustBash,
} from "./sandbox/just-bash.js";
import { isVercelSandbox, wrapVercelSandbox } from "./sandbox/vercel.js";
import { createBashExecuteTool } from "./tools/bash.js";
import { createReadFileTool } from "./tools/read-file.js";
import { createWriteFileTool } from "./tools/write-file.js";
import type { BashToolkit, CreateBashToolOptions, Sandbox } from "./types.js";

const DEFAULT_DESTINATION = "/workspace";

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
  const destination = options.destination ?? DEFAULT_DESTINATION;

  // 1. Load files from disk and/or inline
  const loadedFiles = await loadFiles({
    files: options.files,
    uploadDirectory: options.uploadDirectory,
  });

  // 2. Prefix all file paths with destination
  const filesWithDestination: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(loadedFiles)) {
    const absolutePath = path.posix.join(destination, relativePath);
    filesWithDestination[absolutePath] = content;
  }

  // 3. Create or wrap sandbox
  let sandbox: Sandbox;

  if (options.sandbox) {
    // Check @vercel/sandbox first (more specific check)
    if (isVercelSandbox(options.sandbox)) {
      sandbox = wrapVercelSandbox(options.sandbox);
    } else if (isJustBash(options.sandbox)) {
      sandbox = wrapJustBash(options.sandbox);
    } else {
      sandbox = options.sandbox as Sandbox;
    }

    // Write files to existing sandbox
    for (const [filePath, content] of Object.entries(filesWithDestination)) {
      await sandbox.writeFile(filePath, content);
    }
  } else {
    // Create just-bash sandbox with files
    sandbox = await createJustBashSandbox({
      files: filesWithDestination,
      cwd: destination,
    });
  }

  // 4. Create tools
  const fileList = Object.keys(loadedFiles);

  const bash = createBashExecuteTool({
    sandbox,
    cwd: destination,
    files: fileList,
    extraInstructions: options.extraInstructions,
    onCall: options.onCall,
  });

  const tools = {
    bash,
    readFile: createReadFileTool({
      sandbox,
      onCall: options.onCall,
    }),
    writeFile: createWriteFileTool({
      sandbox,
      onCall: options.onCall,
    }),
  };

  return { bash, tools, sandbox };
}
