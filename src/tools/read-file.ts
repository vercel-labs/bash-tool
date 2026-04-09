import nodePath from "node:path";
import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "../types.js";

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const readFileSchema = z.object({
  path: z.string().describe("The path to the file to read"),
});

interface CreateReadFileToolOptions {
  sandbox: Sandbox;
  /** Working directory for resolving relative paths */
  cwd: string;
}

export function createReadFileTool(options: CreateReadFileToolOptions) {
  const { sandbox, cwd } = options;

  return tool({
    description:
      "Read the contents of a file from the sandbox. " +
      "For image files (png, jpg, jpeg, gif, webp), returns visual content the model can see.",
    inputSchema: readFileSchema,
    execute: async ({ path }) => {
      const resolvedPath = nodePath.posix.resolve(cwd, path);
      const ext = nodePath.extname(resolvedPath).toLowerCase();
      const mediaType = IMAGE_TYPES[ext];

      if (mediaType && sandbox.readFileBuffer) {
        const buffer = await sandbox.readFileBuffer(resolvedPath);
        const base64 = Buffer.from(buffer).toString("base64");
        return { data: base64, mediaType };
      }

      const content = await sandbox.readFile(resolvedPath);
      return { content };
    },

    toModelOutput({
      output,
    }: {
      toolCallId: string;
      input: unknown;
      output: Record<string, unknown>;
    }) {
      if ("data" in output) {
        return {
          type: "content" as const,
          value: [
            {
              type: "image-data" as const,
              data: output.data as string,
              mediaType: output.mediaType as string,
            },
          ],
        };
      }
      return { type: "json" as const, value: output as never };
    },
  });
}
