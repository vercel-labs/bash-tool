import { tool } from "ai";
import { z } from "zod";
import { posixResolve } from "../posix-path.js";
import type { Sandbox } from "../types.js";

const readFileSchema = z.object({
  path: z.string().describe("The path to the file to read"),
});

export interface CreateReadFileToolOptions {
  sandbox: Sandbox;
  /** Working directory for resolving relative paths */
  cwd: string;
}

export function createReadFileTool(options: CreateReadFileToolOptions) {
  const { sandbox, cwd } = options;

  return tool({
    description: "Read the contents of a file from the sandbox.",
    inputSchema: readFileSchema,
    execute: async ({ path }) => {
      const resolvedPath = posixResolve(cwd, path);
      const content = await sandbox.readFile(resolvedPath);
      return { content };
    },
  });
}
