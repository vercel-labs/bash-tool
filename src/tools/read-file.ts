import nodePath from "node:path";
import { type Tool, tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";

const readFileSchema = z.object({
  path: z.string().describe("The path to the file to read"),
});

interface CreateReadFileToolOptions {
  sandbox: Sandbox;
  /** Working directory for resolving relative paths */
  cwd: string;
}

export function createReadFileTool(
  options: CreateReadFileToolOptions,
): Tool<z.infer<typeof readFileSchema>, { content: string }> {
  const { sandbox, cwd } = options;

  return tool({
    description: "Read the contents of a file from the sandbox.",
    inputSchema: readFileSchema,
    execute: async ({ path }) => {
      const resolvedPath = nodePath.posix.resolve(cwd, path);
      const content = await sandbox.readFile(resolvedPath);
      return { content };
    },
  });
}
