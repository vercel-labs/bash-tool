import { tool } from "ai";
import { z } from "zod";
import type {
  AfterBashCallInput,
  AfterBashCallOutput,
  BeforeBashCallInput,
  BeforeBashCallOutput,
  Sandbox,
} from "../types.js";

const bashSchema = z.object({
  command: z.string().describe("The bash command to execute"),
});

/** Default maximum length for stdout/stderr output (30KB) */
export const DEFAULT_MAX_OUTPUT_LENGTH = 30_000;

export interface CreateBashToolOptions {
  sandbox: Sandbox;
  /** Working directory for command execution */
  cwd: string;
  /** List of file paths available in the sandbox (relative to cwd) */
  files?: string[];
  extraInstructions?: string;
  /** Auto-generated prompt describing available bash tools */
  toolPrompt?: string;
  /** Callback before command execution, can modify the command */
  onBeforeBashCall?: (
    input: BeforeBashCallInput,
  ) => BeforeBashCallOutput | undefined;
  /** Callback after command execution, can modify the result */
  onAfterBashCall?: (
    input: AfterBashCallInput,
  ) => AfterBashCallOutput | undefined;
  /**
   * Maximum length (in characters) for stdout and stderr output.
   * If output exceeds this limit, it will be truncated with a message.
   * @default 30000
   */
  maxOutputLength?: number;
}

/**
 * Truncates a string if it exceeds the maximum length, appending a truncation notice.
 */
function truncateOutput(
  output: string,
  maxLength: number,
  streamName: "stdout" | "stderr",
): string {
  if (output.length <= maxLength) {
    return output;
  }
  const truncatedLength = output.length - maxLength;
  return `${output.slice(0, maxLength)}\n\n[${streamName} truncated: ${truncatedLength} characters removed]`;
}

function generateDescription(options: CreateBashToolOptions): string {
  const { cwd, files, extraInstructions, toolPrompt } = options;

  const lines: string[] = [
    "Execute bash commands in the sandbox environment.",
    "",
    `WORKING DIRECTORY: ${cwd}`,
    "All commands execute from this directory. Use relative paths from here.",
    "",
  ];

  // Add file discovery hints if files are provided
  if (files && files.length > 0) {
    const sampleFiles = files.slice(0, 8);

    lines.push("Available files:");
    for (const file of sampleFiles) {
      lines.push(`  ${file}`);
    }
    if (files.length > 8) {
      lines.push(`  ... and ${files.length - 8} more files`);
    }
    lines.push("");
  }

  // Add available tools prompt if provided
  if (toolPrompt) {
    lines.push(toolPrompt);
    lines.push("");
  }

  lines.push("Common operations:");
  lines.push("  ls -la              # List files with details");
  lines.push("  find . -name '*.ts' # Find files by pattern");
  lines.push("  grep -r 'pattern' . # Search file contents");
  lines.push("  cat <file>          # View file contents");
  lines.push("");

  if (extraInstructions) {
    lines.push(extraInstructions);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function createBashExecuteTool(options: CreateBashToolOptions) {
  const {
    sandbox,
    cwd,
    onBeforeBashCall,
    onAfterBashCall,
    maxOutputLength = DEFAULT_MAX_OUTPUT_LENGTH,
  } = options;

  return tool({
    description: generateDescription(options),
    inputSchema: bashSchema,
    execute: async ({ command: originalCommand }) => {
      // Allow modification of command before execution
      let command = originalCommand;
      if (onBeforeBashCall) {
        const beforeResult = onBeforeBashCall({ command });
        if (beforeResult?.command !== undefined) {
          command = beforeResult.command;
        }
      }

      // Prepend cd to ensure commands run in the working directory
      const fullCommand = `cd "${cwd}" && ${command}`;

      // Execute the command
      let result = await sandbox.executeCommand(fullCommand);

      // Truncate output if needed
      result = {
        ...result,
        stdout: truncateOutput(result.stdout, maxOutputLength, "stdout"),
        stderr: truncateOutput(result.stderr, maxOutputLength, "stderr"),
      };

      // Allow modification of result after execution
      if (onAfterBashCall) {
        const afterResult = onAfterBashCall({ command, result });
        if (afterResult?.result !== undefined) {
          result = afterResult.result;
        }
      }

      return result;
    },
  });
}
