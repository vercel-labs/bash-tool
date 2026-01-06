import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";

const writeFileSchema = z.object({
  path: z.string().describe("The path where the file should be written"),
  content: z.string().describe("The content to write to the file"),
});

export interface CreateWriteFileToolOptions {
  sandbox: Sandbox;
}

export function createWriteFileTool(options: CreateWriteFileToolOptions) {
  const { sandbox } = options;

  return tool({
    description:
      "Write content to a file in the sandbox. Creates parent directories if needed.",
    inputSchema: writeFileSchema,
    execute: async ({ path, content }) => {
      await sandbox.writeFile(path, content);
      return { success: true };
    },
  });
}
