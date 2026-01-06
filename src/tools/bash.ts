import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";

const bashSchema = z.object({
  command: z.string().describe("The bash command to execute"),
});

export interface CreateBashToolOptions {
  sandbox: Sandbox;
  /** Working directory for command execution */
  cwd: string;
  /** List of file paths available in the sandbox (relative to cwd) */
  files?: string[];
  extraInstructions?: string;
  onCall?: (toolName: string, args: unknown) => void;
}

function generateDescription(options: CreateBashToolOptions): string {
  const { cwd, files, extraInstructions } = options;

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
  const { sandbox, onCall } = options;

  return tool({
    description: generateDescription(options),
    inputSchema: bashSchema,
    execute: async ({ command }) => {
      onCall?.("bash", { command });
      return sandbox.executeCommand(command);
    },
  });
}
