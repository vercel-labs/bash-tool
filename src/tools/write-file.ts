import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";

const writeFileSchema = z.object({
  path: z.string().describe("The path where the file should be written"),
  content: z.string().describe("The content to write to the file"),
});

export interface CreateWriteFileToolOptions {
  sandbox: Sandbox;
  onCall?: (toolName: string, args: unknown) => void;
}

export function createWriteFileTool(options: CreateWriteFileToolOptions) {
  const { sandbox, onCall } = options;

  return tool({
    description:
      "Write content to a file in the sandbox. Creates parent directories if needed.",
    inputSchema: writeFileSchema,
    execute: async ({ path, content }) => {
      onCall?.("writeFile", { path, content });
      await sandbox.writeFile(path, content);
      return { success: true };
    },
  });
}
