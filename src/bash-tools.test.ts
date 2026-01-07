import { describe, expect, it } from "vitest";
import {
  createToolPrompt,
  detectFormat,
  discoverAvailableTools,
} from "./bash-tools.js";
import type { Sandbox } from "./types.js";

function createMockSandbox(tools: string[]): Sandbox {
  return {
    executeCommand: async (command: string) => {
      // Handle the combined ls command for bin directories
      if (command.startsWith("ls /usr/bin")) {
        // Simulate ls output with directory headers
        const output = tools.length > 0 ? tools.join("\n") : "";
        return {
          stdout: output,
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "Unknown command", exitCode: 1 };
    },
    readFile: async () => "",
    writeFile: async () => {},
  };
}

describe("detectFormat", () => {
  it("detects JSON formats", () => {
    expect(detectFormat("data.json")).toBe("json");
    expect(detectFormat("data.jsonl")).toBe("json");
    expect(detectFormat("data.ndjson")).toBe("json");
  });

  it("detects YAML formats", () => {
    expect(detectFormat("config.yaml")).toBe("yaml");
    expect(detectFormat("config.yml")).toBe("yaml");
  });

  it("detects HTML formats", () => {
    expect(detectFormat("index.html")).toBe("html");
    expect(detectFormat("page.htm")).toBe("html");
  });

  it("detects XML formats", () => {
    expect(detectFormat("data.xml")).toBe("xml");
    expect(detectFormat("icon.svg")).toBe("xml");
  });

  it("detects CSV formats", () => {
    expect(detectFormat("data.csv")).toBe("csv");
    expect(detectFormat("data.tsv")).toBe("csv");
  });

  it("detects TOML format", () => {
    expect(detectFormat("config.toml")).toBe("toml");
  });

  it("detects INI formats", () => {
    expect(detectFormat("config.ini")).toBe("ini");
    expect(detectFormat("settings.cfg")).toBe("ini");
    expect(detectFormat("app.conf")).toBe("ini");
  });

  it("detects binary formats", () => {
    expect(detectFormat("app.bin")).toBe("binary");
    expect(detectFormat("app.exe")).toBe("binary");
    expect(detectFormat("lib.so")).toBe("binary");
    expect(detectFormat("lib.dylib")).toBe("binary");
  });

  it("returns null for unknown formats", () => {
    expect(detectFormat("readme.md")).toBe(null);
    expect(detectFormat("script.ts")).toBe(null);
    expect(detectFormat("noextension")).toBe(null);
  });
});

describe("discoverAvailableTools", () => {
  it("discovers known tools from bin directories", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "unknown-tool"]);

    const tools = await discoverAvailableTools(sandbox);

    expect(tools.has("cat")).toBe(true);
    expect(tools.has("grep")).toBe(true);
    expect(tools.has("sed")).toBe(true);
    expect(tools.has("unknown-tool")).toBe(false);
  });

  it("discovers multiple tools", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "jq", "yq", "sed"]);

    const tools = await discoverAvailableTools(sandbox);

    expect(tools.has("cat")).toBe(true);
    expect(tools.has("grep")).toBe(true);
    expect(tools.has("jq")).toBe(true);
    expect(tools.has("yq")).toBe(true);
    expect(tools.has("sed")).toBe(true);
  });

  it("handles empty output gracefully", async () => {
    const sandbox = createMockSandbox([]);

    const tools = await discoverAvailableTools(sandbox);

    expect(tools.size).toBe(0);
  });

  it("skips directory headers in ls output", async () => {
    const sandbox: Sandbox = {
      executeCommand: async () => ({
        stdout: "/usr/bin:\ncat\ngrep\n/usr/local/bin:\njq",
        stderr: "",
        exitCode: 0,
      }),
      readFile: async () => "",
      writeFile: async () => {},
    };

    const tools = await discoverAvailableTools(sandbox);

    expect(tools.has("cat")).toBe(true);
    expect(tools.has("grep")).toBe(true);
    expect(tools.has("jq")).toBe(true);
    expect(tools.has("/usr/bin:")).toBe(false);
    expect(tools.has("/usr/local/bin:")).toBe(false);
  });
});

describe("createToolPrompt", () => {
  it("generates prompt with available tools sorted alphabetically", async () => {
    const sandbox = createMockSandbox(["grep", "cat", "sed", "awk"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: [],
    });

    expect(prompt).toBe("Available tools: awk, cat, grep, sed, and more");
  });

  it("returns empty string when no tools are available", async () => {
    const sandbox = createMockSandbox([]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: [],
    });

    expect(prompt).toBe("");
  });

  it("includes format-specific hints for JSON files", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "jq", "sed"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["data.json"],
    });

    expect(prompt).toBe(`Available tools: cat, grep, jq, sed, and more
For JSON: jq, grep, sed`);
  });

  it("includes format-specific hints for YAML files", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "yq"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["config.yaml"],
    });

    expect(prompt).toBe(`Available tools: cat, grep, sed, yq, and more
For YAML: yq, grep, sed`);
  });

  it("includes format-specific hints for HTML files", async () => {
    const sandbox = createMockSandbox([
      "cat",
      "grep",
      "sed",
      "curl",
      "html-to-markdown",
    ]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["index.html"],
    });

    expect(
      prompt,
    ).toBe(`Available tools: cat, curl, grep, html-to-markdown, sed, and more
For HTML: html-to-markdown, grep, sed`);
  });

  it("includes format-specific hints for XML files with yq", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "awk", "yq"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["data.xml"],
    });

    expect(prompt).toBe(`Available tools: awk, cat, grep, sed, yq, and more
For XML: yq, grep, sed`);
  });

  it("includes format-specific hints for CSV files without yq by default", async () => {
    const sandbox = createMockSandbox([
      "awk",
      "cat",
      "cut",
      "grep",
      "sed",
      "sort",
      "yq",
    ]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["data.csv"],
      isJustBash: false,
    });

    expect(
      prompt,
    ).toBe(`Available tools: awk, cat, cut, grep, sed, sort, yq, and more
For CSV/TSV: awk, cut, sort`);
  });

  it("includes yq for CSV files when isJustBash is true", async () => {
    const sandbox = createMockSandbox([
      "awk",
      "cat",
      "cut",
      "grep",
      "sed",
      "sort",
      "yq",
    ]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["data.csv"],
      isJustBash: true,
    });

    expect(
      prompt,
    ).toBe(`Available tools: awk, cat, cut, grep, sed, sort, yq, and more
For CSV/TSV: yq, awk, cut`);
  });

  it("includes format-specific hints for TOML files", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "yq"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["config.toml"],
    });

    expect(prompt).toBe(`Available tools: cat, grep, sed, yq, and more
For TOML: yq, grep, sed`);
  });

  it("includes format-specific hints for INI files", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "yq"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["settings.ini"],
    });

    expect(prompt).toBe(`Available tools: cat, grep, sed, yq, and more
For INI: yq, grep, sed`);
  });

  it("handles multiple file formats", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "jq", "yq"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["data.json", "config.yaml", "readme.md"],
    });

    expect(prompt).toBe(`Available tools: cat, grep, jq, sed, yq, and more
For JSON: jq, grep, sed
For YAML: yq, grep, sed`);
  });

  it("does not include hints for text or binary formats", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed", "strings"]);

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["readme.md", "app.exe"],
    });

    // No format-specific hints for .md (unknown) or .exe (binary)
    expect(prompt).toBe("Available tools: cat, grep, sed, strings, and more");
  });

  it("only shows format hints for available tools", async () => {
    const sandbox = createMockSandbox(["cat", "grep", "sed"]);
    // jq is NOT available

    const prompt = await createToolPrompt({
      sandbox,
      filenames: ["data.json"],
    });

    // Should not show jq since it's not available
    expect(prompt).toBe(`Available tools: cat, grep, sed, and more
For JSON: grep, sed, cat`);
  });
});
