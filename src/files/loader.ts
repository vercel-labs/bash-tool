import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

export interface LoadFilesOptions {
  files?: Record<string, string>;
  uploadDirectory?: {
    source: string;
    include?: string;
  };
}

export interface FileEntry {
  path: string;
  content: Buffer;
}

/**
 * Stream files from inline definitions and/or a directory on disk.
 * Yields files one at a time to avoid loading everything into memory.
 * If both are provided, inline files take precedence (override directory files).
 */
export async function* streamFiles(
  options: LoadFilesOptions,
): AsyncGenerator<FileEntry> {
  const yieldedPaths = new Set<string>();

  // Yield inline files first (they take precedence)
  if (options.files) {
    for (const [relativePath, content] of Object.entries(options.files)) {
      yieldedPaths.add(relativePath);
      yield { path: relativePath, content: Buffer.from(content) };
    }
  }

  // Stream from directory (skip files already yielded from inline)
  if (options.uploadDirectory) {
    const { source, include = "**/*" } = options.uploadDirectory;
    const absoluteSource = path.resolve(source);

    const foundPaths = await fg(include, {
      cwd: absoluteSource,
      dot: true,
      onlyFiles: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });

    for (const relativePath of foundPaths) {
      if (yieldedPaths.has(relativePath)) {
        continue; // Skip - inline file takes precedence
      }
      const absolutePath = path.join(absoluteSource, relativePath);
      const content = await fs.readFile(absolutePath);
      yield { path: relativePath, content };
    }
  }
}

/**
 * Get file paths from options without loading content.
 * Useful for tool prompts and OverlayFs.
 */
export async function getFilePaths(
  options: LoadFilesOptions,
): Promise<string[]> {
  "use step";
  const paths: string[] = [];

  if (options.uploadDirectory) {
    const { source, include = "**/*" } = options.uploadDirectory;
    const absoluteSource = path.resolve(source);

    const foundPaths = await fg(include, {
      cwd: absoluteSource,
      dot: true,
      onlyFiles: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });
    paths.push(...foundPaths);
  }

  // Add inline file paths (may override some from directory)
  if (options.files) {
    for (const relativePath of Object.keys(options.files)) {
      if (!paths.includes(relativePath)) {
        paths.push(relativePath);
      }
    }
  }

  return paths;
}
