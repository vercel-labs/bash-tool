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

type FastGlobFn = (
  source: string | string[],
  options?: import("fast-glob").Options,
) => Promise<string[]>;

// Lazy-loaded Node.js dependencies
let cachedDeps: {
  fs: typeof import("node:fs/promises");
  path: typeof import("node:path");
  fg: FastGlobFn;
} | null = null;

async function loadNodeDependencies() {
  if (cachedDeps) {
    return cachedDeps;
  }

  try {
    const [fs, path, fgModule] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("fast-glob"),
    ]);
    // fast-glob uses `export =` so dynamic import wraps it as { default: ... }
    const fg = fgModule.default as FastGlobFn;
    cachedDeps = { fs, path, fg };
    return cachedDeps;
  } catch {
    throw new Error(
      "uploadDirectory requires Node.js. " +
        "In browser environments, use the 'files' option to provide file contents directly instead.",
    );
  }
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
    const { fs, path, fg } = await loadNodeDependencies();
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
  const paths: string[] = [];

  if (options.uploadDirectory) {
    const { path, fg } = await loadNodeDependencies();
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
