import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";

const readFileSchema = z.object({
  path: z.string().describe("The path to the file to read"),
});

export interface CreateReadFileToolOptions {
  sandbox: Sandbox;
  onCall?: (toolName: string, args: unknown) => void;
}

export function createReadFileTool(options: CreateReadFileToolOptions) {
  const { sandbox, onCall } = options;

  return tool({
    description: "Read the contents of a file from the sandbox.",
    inputSchema: readFileSchema,
    execute: async ({ path }) => {
      onCall?.("readFile", { path });
      const content = await sandbox.readFile(path);
      return { content };
    },
  });
}
