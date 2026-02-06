/**
 * Browser-compatible POSIX path utilities.
 * These functions handle forward-slash paths without Node.js dependencies.
 */

/**
 * Join path segments with forward slashes.
 * Normalizes the result to remove redundant slashes and resolve . and ..
 */
export function posixJoin(...segments: string[]): string {
  const joined = segments.filter(Boolean).join("/");
  return normalizePosixPath(joined);
}

/**
 * Resolve a path against a base directory.
 * If the path is absolute (starts with /), return it normalized.
 * Otherwise, join it with the base and normalize.
 */
export function posixResolve(base: string, relativePath: string): string {
  if (relativePath.startsWith("/")) {
    return normalizePosixPath(relativePath);
  }
  return normalizePosixPath(`${base}/${relativePath}`);
}

/**
 * Normalize a POSIX path by resolving . and .. segments and removing duplicate slashes.
 */
function normalizePosixPath(p: string): string {
  const isAbsolute = p.startsWith("/");
  const segments = p.split("/").filter((s) => s !== "" && s !== ".");
  const result: string[] = [];

  for (const segment of segments) {
    if (segment === "..") {
      if (result.length > 0 && result[result.length - 1] !== "..") {
        result.pop();
      } else if (!isAbsolute) {
        result.push("..");
      }
    } else {
      result.push(segment);
    }
  }

  const normalized = result.join("/");
  return isAbsolute ? `/${normalized}` : normalized || ".";
}
