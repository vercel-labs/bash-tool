import nodePath from "node:path";
import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";
import { parseInvocationLog } from "./bash.js";

const readFileSchema = z.object({
  path: z.string().describe("The path to the file to read"),
  outputFilter: z
    .string()
    .optional()
    .describe(
      "Optional shell filter to apply to content (e.g., 'tail -20', 'grep -i error')",
    ),
});

export interface CreateReadFileToolOptions {
  sandbox: Sandbox;
  /** Working directory for resolving relative paths */
  cwd: string;
}

/**
 * Check if a file is an invocation log file by extension.
 */
function isInvocationFile(filePath: string): boolean {
  return filePath.endsWith(".invocation");
}

/**
 * Parse invocation log content and extract stdout.
 */
function parseInvocationContent(content: string): string {
  try {
    const log = parseInvocationLog(content);
    return log.stdout;
  } catch {
    // If parsing fails, return original content
    return content;
  }
}

/**
 * Apply a shell filter to file content using cat.
 */
async function applyFilterWithCat(
  sandbox: Sandbox,
  cwd: string,
  filePath: string,
  filter: string,
): Promise<{ content: string; error?: string }> {
  const filterCommand = `cd "${cwd}" && cat "${filePath}" | ${filter}`;

  const result = await sandbox.executeCommand(filterCommand);

  if (result.exitCode !== 0) {
    return {
      content: "",
      error: `Filter error: ${result.stderr}`,
    };
  }

  return { content: result.stdout };
}

/**
 * Apply a shell filter to in-memory content using printf.
 */
async function applyFilterToContent(
  sandbox: Sandbox,
  cwd: string,
  content: string,
  filter: string,
): Promise<{ content: string; error?: string }> {
  // Use printf to handle special characters and avoid issues with echo
  const escapedContent = content.replace(/\\/g, "\\\\").replace(/'/g, "'\\''");
  const filterCommand = `cd "${cwd}" && printf '%s' '${escapedContent}' | ${filter}`;

  const result = await sandbox.executeCommand(filterCommand);

  if (result.exitCode !== 0) {
    return {
      content,
      error: `Filter error: ${result.stderr}`,
    };
  }

  return { content: result.stdout };
}

export function createReadFileTool(options: CreateReadFileToolOptions) {
  const { sandbox, cwd } = options;

  return tool({
    description:
      "Read the contents of a file from the sandbox. " +
      "For .invocation files, extracts the stdout from the stored command output.",
    inputSchema: readFileSchema,
    execute: async ({ path, outputFilter }) => {
      const resolvedPath = nodePath.posix.resolve(cwd, path);

      // For invocation files, we need to read and parse to extract stdout
      if (isInvocationFile(path)) {
        let content = await sandbox.readFile(resolvedPath);
        content = parseInvocationContent(content);

        // Apply filter to the extracted stdout content
        if (outputFilter) {
          const filterResult = await applyFilterToContent(
            sandbox,
            cwd,
            content,
            outputFilter,
          );
          if (filterResult.error) {
            return { content: filterResult.content, error: filterResult.error };
          }
          content = filterResult.content;
        }

        return { content };
      }

      // For regular files with a filter, use cat | filter directly
      if (outputFilter) {
        const filterResult = await applyFilterWithCat(
          sandbox,
          cwd,
          resolvedPath,
          outputFilter,
        );
        if (filterResult.error) {
          // On filter error, fall back to reading the file normally
          const content = await sandbox.readFile(resolvedPath);
          return { content, error: filterResult.error };
        }
        return { content: filterResult.content };
      }

      // No filter, just read the file normally
      const content = await sandbox.readFile(resolvedPath);
      return { content };
    },
  });
}
