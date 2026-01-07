import type { Sandbox } from "./types.js";

/**
 * Common bash tools for text processing used by AI agents.
 */

export interface BashToolInfo {
  name: string;
  purpose: string;
  category: BashToolCategory;
}

export type BashToolCategory =
  | "search"
  | "transform"
  | "view"
  | "organize"
  | "compare"
  | "count-format"
  | "structured-data"
  | "network"
  | "utilities";

export type FileFormat =
  | "json"
  | "yaml"
  | "html"
  | "xml"
  | "csv"
  | "toml"
  | "ini"
  | "binary"
  | "text";

export const bashTools: BashToolInfo[] = [
  {
    name: "grep",
    purpose: "Pattern matching and searching (regex support)",
    category: "search",
  },
  {
    name: "sed",
    purpose: "Stream editor for substitution and transformation",
    category: "transform",
  },
  {
    name: "awk",
    purpose: "Field-based processing and pattern scanning",
    category: "transform",
  },
  {
    name: "cat",
    purpose: "Concatenate and display file contents",
    category: "view",
  },
  { name: "head", purpose: "View first N lines of a file", category: "view" },
  {
    name: "tail",
    purpose: "View last N lines (also follow logs with -f)",
    category: "view",
  },
  {
    name: "sort",
    purpose: "Sort lines alphabetically/numerically",
    category: "organize",
  },
  {
    name: "uniq",
    purpose: "Remove duplicates or count occurrences",
    category: "organize",
  },
  {
    name: "cut",
    purpose: "Extract columns/fields by delimiter",
    category: "organize",
  },
  {
    name: "tr",
    purpose: "Translate, squeeze, or delete characters",
    category: "transform",
  },
  {
    name: "wc",
    purpose: "Count lines, words, characters",
    category: "count-format",
  },
  {
    name: "find",
    purpose: "Locate files (often piped to text tools)",
    category: "search",
  },
  {
    name: "xargs",
    purpose: "Build commands from stdin",
    category: "utilities",
  },
  { name: "diff", purpose: "Compare files line by line", category: "compare" },
  {
    name: "jq",
    purpose: "Parse and manipulate JSON",
    category: "structured-data",
  },
  {
    name: "yq",
    purpose:
      "Parse and manipulate YAML, XML, TOML, INI (mikefarah/yq); CSV in just-bash",
    category: "structured-data",
  },
  {
    name: "tee",
    purpose: "Split output to file and stdout",
    category: "utilities",
  },
  {
    name: "paste",
    purpose: "Merge lines from multiple files",
    category: "organize",
  },
  {
    name: "column",
    purpose: "Format text into aligned columns",
    category: "count-format",
  },
  {
    name: "printf",
    purpose: "Formatted output with precise control",
    category: "count-format",
  },
  {
    name: "comm",
    purpose: "Compare two sorted files (common/unique lines)",
    category: "compare",
  },
  {
    name: "rev",
    purpose: "Reverse characters in each line",
    category: "transform",
  },
  {
    name: "fold",
    purpose: "Wrap lines to specified width",
    category: "count-format",
  },
  { name: "nl", purpose: "Number lines in output", category: "count-format" },
  {
    name: "split",
    purpose: "Split file into smaller pieces",
    category: "organize",
  },
  {
    name: "join",
    purpose: "SQL-like join on sorted files",
    category: "organize",
  },
  { name: "less", purpose: "Pager for viewing large files", category: "view" },
  { name: "expand", purpose: "Convert tabs to spaces", category: "transform" },
  {
    name: "unexpand",
    purpose: "Convert spaces to tabs",
    category: "transform",
  },
  {
    name: "strings",
    purpose: "Extract printable strings from binaries",
    category: "view",
  },
  { name: "od", purpose: "Octal dump for binary inspection", category: "view" },
  { name: "xxd", purpose: "Hex dump for binary inspection", category: "view" },
  {
    name: "iconv",
    purpose: "Convert between character encodings",
    category: "transform",
  },
  { name: "curl", purpose: "Fetch content from URLs", category: "network" },
  {
    name: "html-to-markdown",
    purpose: "Convert HTML to markdown (just-bash)",
    category: "transform",
  },
];

/**
 * Maps file formats to the bash tools most useful for processing them.
 */
export const toolsByFormat: Record<FileFormat, string[]> = {
  json: ["jq", "grep", "sed", "cat", "head", "tail", "less", "curl"],
  yaml: ["yq", "grep", "sed", "cat", "head", "tail", "less"],
  html: ["html-to-markdown", "grep", "sed", "curl", "cat", "less"],
  xml: ["yq", "grep", "sed", "awk", "cat", "head", "tail", "less"],
  csv: [
    "awk",
    "cut",
    "sort",
    "uniq",
    "join",
    "paste",
    "column",
    "grep",
    "sed",
    "head",
    "tail",
  ],
  toml: ["yq", "grep", "sed", "cat", "head", "tail", "less"],
  ini: ["yq", "grep", "sed", "cat", "head", "tail", "less"],
  binary: ["strings", "od", "xxd", "head", "tail", "split"],
  text: [
    "grep",
    "sed",
    "awk",
    "cat",
    "head",
    "tail",
    "sort",
    "uniq",
    "cut",
    "tr",
    "wc",
    "diff",
    "comm",
    "paste",
    "join",
    "column",
    "fold",
    "nl",
    "rev",
    "iconv",
  ],
};

/**
 * Get tools by category.
 */
export function getToolsByCategory(category: BashToolCategory): BashToolInfo[] {
  return bashTools.filter((tool) => tool.category === category);
}

/**
 * Get tools suitable for a specific file format.
 */
export function getToolsForFormat(format: FileFormat): BashToolInfo[] {
  const toolNames = toolsByFormat[format];
  return bashTools.filter((tool) => toolNames.includes(tool.name));
}

/**
 * File extension to format mapping.
 */
const extensionToFormat: Record<string, FileFormat> = {
  ".json": "json",
  ".jsonl": "json",
  ".ndjson": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".html": "html",
  ".htm": "html",
  ".xml": "xml",
  ".svg": "xml",
  ".csv": "csv",
  ".tsv": "csv",
  ".toml": "toml",
  ".ini": "ini",
  ".cfg": "ini",
  ".conf": "ini",
  ".bin": "binary",
  ".exe": "binary",
  ".so": "binary",
  ".dylib": "binary",
  ".a": "binary",
  ".o": "binary",
};

/**
 * Detect file format from filename.
 */
export function detectFormat(filename: string): FileFormat | null {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return extensionToFormat[ext] ?? null;
}

/**
 * Discover available bash tools by checking bin directories.
 */
export async function discoverAvailableTools(
  sandbox: Sandbox,
): Promise<Set<string>> {
  const availableTools = new Set<string>();
  const knownToolNames = new Set(bashTools.map((t) => t.name));

  // List all bin directories in a single command
  const result = await sandbox.executeCommand(
    "ls /usr/bin /usr/local/bin /bin /sbin /usr/sbin 2>/dev/null",
  );

  if (result.exitCode === 0 || result.stdout) {
    const tools = result.stdout.split("\n").filter(Boolean);
    for (const tool of tools) {
      // Skip directory headers (e.g., "/usr/bin:")
      if (tool.endsWith(":")) continue;
      if (knownToolNames.has(tool)) {
        availableTools.add(tool);
      }
    }
  }

  return availableTools;
}

export interface ToolPromptOptions {
  /** The sandbox to check for available tools */
  sandbox: Sandbox;
  /** List of filenames to detect formats from */
  filenames: string[];
  /** Set to true if using just-bash sandbox (enables yq CSV support) */
  isJustBash?: boolean;
}

/**
 * Creates a prompt describing available bash tools and format-specific tools.
 *
 * @example
 * ```typescript
 * const prompt = await createToolPrompt({
 *   sandbox,
 *   filenames: ["data.json", "config.yaml", "readme.md"]
 * });
 * // Returns something like:
 * // "Available tools: cat, grep, sed, awk, head, tail, sort, jq, yq, ...
 * //  For JSON files: jq
 * //  For YAML files: yq"
 * ```
 */
export async function createToolPrompt(
  options: ToolPromptOptions,
): Promise<string> {
  const { sandbox, filenames, isJustBash = false } = options;

  // Discover available tools
  const availableTools = await discoverAvailableTools(sandbox);

  if (availableTools.size === 0) {
    return "";
  }

  // Build the main tools list (sorted alphabetically)
  const sortedTools = [...availableTools].sort();
  const lines: string[] = [
    `Available tools: ${sortedTools.join(", ")}, and more`,
  ];

  // Detect formats from filenames
  const detectedFormats = new Set<FileFormat>();
  for (const filename of filenames) {
    const format = detectFormat(filename);
    if (format && format !== "text" && format !== "binary") {
      detectedFormats.add(format);
    }
  }

  // Add format-specific tool hints
  const formatLabels: Record<FileFormat, string> = {
    json: "JSON",
    yaml: "YAML",
    html: "HTML",
    xml: "XML",
    csv: "CSV/TSV",
    toml: "TOML",
    ini: "INI",
    binary: "binary",
    text: "text",
  };

  for (const format of detectedFormats) {
    let formatToolNames = toolsByFormat[format];

    // Add yq for CSV only in just-bash (where it has CSV support)
    if (format === "csv" && isJustBash) {
      formatToolNames = ["yq", ...formatToolNames];
    }

    const formatTools = formatToolNames.filter((t) => availableTools.has(t));
    if (formatTools.length > 0) {
      // Highlight the primary tool for this format
      const primaryTools = formatTools.slice(0, 3).join(", ");
      lines.push(`For ${formatLabels[format]}: ${primaryTools}`);
    }
  }

  return lines.join("\n");
}
