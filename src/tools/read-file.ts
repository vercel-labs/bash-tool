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
 * Extract stdout from invocation file and apply filter in a single command.
 * Uses sed to extract content between ---STDOUT--- and ---STDERR--- markers.
 */
async function applyFilterToInvocationFile(
  sandbox: Sandbox,
  cwd: string,
  filePath: string,
  filter: string,
): Promise<{ content: string; error?: string }> {
  // Extract stdout section and pipe through filter
  // sed extracts lines between ---STDOUT--- and ---STDERR--- (exclusive)
  const filterCommand = `cd "${cwd}" && sed -n '/^---STDOUT---$/,/^---STDERR---$/{ /^---STDOUT---$/d; /^---STDERR---$/d; p }' "${filePath}" | ${filter}`;

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
 * Extract stdout from invocation file using sed.
 */
async function extractInvocationStdout(
  sandbox: Sandbox,
  cwd: string,
  filePath: string,
): Promise<string> {
  // Extract stdout section using sed
  const command = `cd "${cwd}" && sed -n '/^---STDOUT---$/,/^---STDERR---$/{ /^---STDOUT---$/d; /^---STDERR---$/d; p }' "${filePath}"`;

  const result = await sandbox.executeCommand(command);

  if (result.exitCode !== 0) {
    // Fall back to reading and parsing
    const content = await sandbox.readFile(filePath);
    return parseInvocationContent(content);
  }

  return result.stdout;
}

function generateDescription(): string {
  const lines = [
    "Read the contents of a file from the sandbox.",
    "",
    "OUTPUT FILTERING:",
    "Use the outputFilter parameter to filter content before it is returned.",
    "Examples:",
    '  outputFilter: "tail -50"      # Last 50 lines',
    '  outputFilter: "head -100"     # First 100 lines',
    '  outputFilter: "grep error"    # Lines containing "error"',
    '  outputFilter: "grep -i warn"  # Case-insensitive search',
    "",
    "INVOCATION FILES:",
    "For .invocation files (from bash tool logs), automatically extracts stdout.",
    "Use outputFilter to re-query stored command output with different filters.",
    'Example: readFile({ path: "...invocation", outputFilter: "grep -i error" })',
  ];
  return lines.join("\n");
}

export function createReadFileTool(options: CreateReadFileToolOptions) {
  const { sandbox, cwd } = options;

  return tool({
    description: generateDescription(),
    inputSchema: readFileSchema,
    execute: async ({ path, outputFilter }) => {
      const resolvedPath = nodePath.posix.resolve(cwd, path);

      // For invocation files, extract stdout section
      if (isInvocationFile(path)) {
        if (outputFilter) {
          // Use sed to extract stdout and pipe through filter in one command
          const filterResult = await applyFilterToInvocationFile(
            sandbox,
            cwd,
            resolvedPath,
            outputFilter,
          );
          if (filterResult.error) {
            // Fall back to reading file and parsing
            const content = await extractInvocationStdout(
              sandbox,
              cwd,
              resolvedPath,
            );
            return { content, error: filterResult.error };
          }
          return { content: filterResult.content };
        }

        // No filter, just extract stdout
        const content = await extractInvocationStdout(
          sandbox,
          cwd,
          resolvedPath,
        );
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
