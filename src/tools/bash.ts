import nodePath from "node:path";
import { tool } from "ai";
import { z } from "zod";
import type {
  AfterBashCallInput,
  AfterBashCallOutput,
  BeforeBashCallInput,
  BeforeBashCallOutput,
  Sandbox,
} from "../types.js";

/** Default path for invocation log files */
export const DEFAULT_INVOCATION_LOG_PATH = ".bash-tool/commands";

/**
 * Structure of an invocation log file (parsed form)
 */
export interface InvocationLog {
  timestamp: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  outputFilter?: string;
}

/**
 * Format an invocation log as a grep/tail-friendly text format.
 * Format:
 * ```
 * # timestamp: 2024-01-15T10:30:45.123Z
 * # command: ls -la
 * # exitCode: 0
 * # outputFilter: tail -10
 * ---STDOUT---
 * <stdout content>
 * ---STDERR---
 * <stderr content>
 * ```
 */
function formatInvocationLog(log: InvocationLog): string {
  const lines: string[] = [
    `# timestamp: ${log.timestamp}`,
    `# command: ${log.command}`,
    `# exitCode: ${log.exitCode}`,
  ];
  if (log.outputFilter) {
    lines.push(`# outputFilter: ${log.outputFilter}`);
  }
  lines.push("---STDOUT---");
  lines.push(log.stdout);
  lines.push("---STDERR---");
  lines.push(log.stderr);
  return lines.join("\n");
}

/**
 * Parse an invocation log from text format.
 * Throws if the format is invalid (missing required sections).
 */
export function parseInvocationLog(content: string): InvocationLog {
  const lines = content.split("\n");
  const log: InvocationLog = {
    timestamp: "",
    command: "",
    exitCode: 0,
    stdout: "",
    stderr: "",
  };

  let section: "header" | "stdout" | "stderr" = "header";
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let hasStdoutSection = false;
  let hasStderrSection = false;

  for (const line of lines) {
    if (line === "---STDOUT---") {
      section = "stdout";
      hasStdoutSection = true;
      continue;
    }
    if (line === "---STDERR---") {
      section = "stderr";
      hasStderrSection = true;
      continue;
    }

    if (section === "header" && line.startsWith("# ")) {
      const match = line.match(/^# (\w+): (.*)$/);
      if (match) {
        const [, key, value] = match;
        if (key === "timestamp") log.timestamp = value;
        else if (key === "command") log.command = value;
        else if (key === "exitCode") log.exitCode = Number.parseInt(value, 10);
        else if (key === "outputFilter") log.outputFilter = value;
      }
    } else if (section === "stdout") {
      stdoutLines.push(line);
    } else if (section === "stderr") {
      stderrLines.push(line);
    }
  }

  // Validate that we found the required sections
  if (!hasStdoutSection || !hasStderrSection) {
    throw new Error("Invalid invocation log format: missing required sections");
  }

  log.stdout = stdoutLines.join("\n");
  log.stderr = stderrLines.join("\n");

  return log;
}

/**
 * Generates a filesystem-safe timestamp for invocation log filenames.
 * Replaces colons with dashes to avoid filesystem issues.
 */
function generateInvocationFilename(): string {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  return `${timestamp}.invocation`;
}

const bashSchema = z.object({
  command: z.string().describe("The bash command to execute"),
  outputFilter: z
    .string()
    .optional()
    .describe(
      "Optional shell filter to apply to output (e.g., 'tail -20', 'grep error'). " +
        "Full output is stored in invocation log, filtered output is returned.",
    ),
});

/** Default maximum length for stdout/stderr output (30KB) */
export const DEFAULT_MAX_OUTPUT_LENGTH = 30_000;

export interface CreateBashToolOptions {
  sandbox: Sandbox;
  /** Working directory for command execution */
  cwd: string;
  /** List of file paths available in the sandbox (relative to cwd) */
  files?: string[];
  extraInstructions?: string;
  /** Auto-generated prompt describing available bash tools */
  toolPrompt?: string;
  /** Callback before command execution, can modify the command */
  onBeforeBashCall?: (
    input: BeforeBashCallInput,
  ) => BeforeBashCallOutput | undefined;
  /** Callback after command execution, can modify the result */
  onAfterBashCall?: (
    input: AfterBashCallInput,
  ) => AfterBashCallOutput | undefined;
  /**
   * Maximum length (in characters) for stdout and stderr output.
   * If output exceeds this limit, it will be truncated with a message.
   * @default 30000
   */
  maxOutputLength?: number;
  /**
   * Enable storing full command output in invocation log files.
   * @default false
   */
  enableInvocationLog?: boolean;
  /**
   * Path (relative to cwd) where invocation log files are stored.
   * @default ".bash-tool/commands"
   */
  invocationLogPath?: string;
}

/**
 * Truncates a string if it exceeds the maximum length, appending a truncation notice.
 */
function truncateOutput(
  output: string,
  maxLength: number,
  streamName: "stdout" | "stderr",
): string {
  if (output.length <= maxLength) {
    return output;
  }
  const truncatedLength = output.length - maxLength;
  return `${output.slice(0, maxLength)}\n\n[${streamName} truncated: ${truncatedLength} characters removed]`;
}

function generateDescription(options: CreateBashToolOptions): string {
  const {
    cwd,
    files,
    extraInstructions,
    toolPrompt,
    enableInvocationLog = false,
    invocationLogPath = DEFAULT_INVOCATION_LOG_PATH,
  } = options;

  const lines: string[] = [
    "Execute bash commands in the sandbox environment.",
    "",
    `WORKING DIRECTORY: ${cwd}`,
    "All commands execute from this directory. Use relative paths from here.",
    "",
  ];

  // Add file discovery hints if files are provided
  if (files && files.length > 0) {
    const sampleFiles = files.slice(0, 8);

    lines.push("Available files:");
    for (const file of sampleFiles) {
      lines.push(`  ${file}`);
    }
    if (files.length > 8) {
      lines.push(`  ... and ${files.length - 8} more files`);
    }
    lines.push("");
  }

  // Add available tools prompt if provided
  if (toolPrompt) {
    lines.push(toolPrompt);
    lines.push("");
  }

  lines.push("Common operations:");
  lines.push("  ls -la              # List files with details");
  lines.push("  find . -name '*.ts' # Find files by pattern");
  lines.push("  grep -r 'pattern' . # Search file contents");
  lines.push("  cat <file>          # View file contents");
  lines.push("");

  // Add output filtering documentation
  lines.push("OUTPUT FILTERING:");
  lines.push(
    "Use the outputFilter parameter to filter stdout before it is returned.",
  );
  if (enableInvocationLog) {
    lines.push(
      "Full unfiltered output is saved to the invocation log for later retrieval.",
    );
  }
  lines.push("Examples:");
  lines.push('  outputFilter: "tail -50"      # Last 50 lines');
  lines.push('  outputFilter: "head -100"     # First 100 lines');
  lines.push('  outputFilter: "grep error"    # Lines containing "error"');
  lines.push('  outputFilter: "grep -i warn"  # Case-insensitive search');
  lines.push("");

  // Add invocation log documentation if enabled
  if (enableInvocationLog) {
    lines.push("INVOCATION LOG:");
    lines.push(`Log path: ${invocationLogPath}/<timestamp>.invocation`);
    lines.push(
      "The response includes invocationLogPath with the log file path.",
    );
    lines.push(
      "Use readFile with outputFilter to re-query logs with different filters.",
    );
    lines.push("");
  }

  if (extraInstructions) {
    lines.push(extraInstructions);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function createBashExecuteTool(options: CreateBashToolOptions) {
  const {
    sandbox,
    cwd,
    onBeforeBashCall,
    onAfterBashCall,
    maxOutputLength = DEFAULT_MAX_OUTPUT_LENGTH,
    enableInvocationLog = false,
    invocationLogPath = DEFAULT_INVOCATION_LOG_PATH,
  } = options;

  return tool({
    description: generateDescription(options),
    inputSchema: bashSchema,
    execute: async ({ command: originalCommand, outputFilter }) => {
      // Allow modification of command before execution
      let command = originalCommand;
      if (onBeforeBashCall) {
        const beforeResult = onBeforeBashCall({ command });
        if (beforeResult?.command !== undefined) {
          command = beforeResult.command;
        }
      }

      let result: { stdout: string; stderr: string; exitCode: number };
      let logPath: string | undefined;

      // Optimized path: when filter is specified, use temp files to avoid
      // transferring full output to Node.js and back
      if (outputFilter) {
        const execResult = await executeWithFilter(
          sandbox,
          cwd,
          command,
          outputFilter,
          enableInvocationLog
            ? {
                logDir: nodePath.posix.join(cwd, invocationLogPath),
                logPath: nodePath.posix.join(
                  cwd,
                  invocationLogPath,
                  generateInvocationFilename(),
                ),
              }
            : undefined,
        );
        result = execResult.result;
        logPath = execResult.logPath;
      } else {
        // No filter: execute command directly
        const fullCommand = `cd "${cwd}" && ${command}`;
        result = await sandbox.executeCommand(fullCommand);

        // Store full output in invocation log if enabled
        if (enableInvocationLog) {
          const invocationLog: InvocationLog = {
            timestamp: new Date().toISOString(),
            command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          };

          const filename = generateInvocationFilename();
          const logDir = nodePath.posix.join(cwd, invocationLogPath);
          logPath = nodePath.posix.join(logDir, filename);

          await sandbox.executeCommand(`mkdir -p "${logDir}"`);
          await sandbox.writeFiles([
            { path: logPath, content: formatInvocationLog(invocationLog) },
          ]);
        }
      }

      // Truncate output if needed
      result = {
        ...result,
        stdout: truncateOutput(result.stdout, maxOutputLength, "stdout"),
        stderr: truncateOutput(result.stderr, maxOutputLength, "stderr"),
      };

      // Allow modification of result after execution
      if (onAfterBashCall) {
        const afterResult = onAfterBashCall({ command, result });
        if (afterResult?.result !== undefined) {
          result = afterResult.result;
        }
      }

      // Include invocation log path in response if logging is enabled
      if (logPath) {
        return { ...result, invocationLogPath: logPath };
      }

      return result;
    },
  });
}

/**
 * Execute a command with output filter using temp files.
 * This keeps full output in the sandbox and only returns filtered output.
 * Optionally writes invocation log in the same bash invocation.
 */
async function executeWithFilter(
  sandbox: Sandbox,
  cwd: string,
  command: string,
  filter: string,
  invocationLog?: { logDir: string; logPath: string },
): Promise<{
  result: { stdout: string; stderr: string; exitCode: number };
  logPath?: string;
}> {
  const timestamp = new Date().toISOString();
  const escapedCommand = command.replace(/'/g, "'\\''");
  const escapedFilter = filter.replace(/'/g, "'\\''");

  // Use fixed temp file paths based on timestamp to avoid mktemp issues
  const tempId = timestamp.replace(/[:.]/g, "-");
  const tmpStdout = `/tmp/bash-tool-stdout-${tempId}`;
  const tmpStderr = `/tmp/bash-tool-stderr-${tempId}`;

  // Build a single bash script that:
  // 1. Runs the command, capturing output to temp files
  // 2. Optionally writes the invocation log
  // 3. Filters and outputs the result
  // 4. Cleans up temp files
  // 5. Exits with the original command's exit code

  let script = `
# Run command and capture output
cd "${cwd}" && ${command} > "${tmpStdout}" 2> "${tmpStderr}"
cmd_exit=$?
`;

  if (invocationLog) {
    // Add invocation log writing to the script
    script += `
# Write invocation log
mkdir -p "${invocationLog.logDir}"
cat > "${invocationLog.logPath}" << 'INVOCATION_HEADER'
# timestamp: ${timestamp}
# command: ${escapedCommand}
INVOCATION_HEADER
echo "# exitCode: $cmd_exit" >> "${invocationLog.logPath}"
echo "# outputFilter: ${escapedFilter}" >> "${invocationLog.logPath}"
echo "---STDOUT---" >> "${invocationLog.logPath}"
cat "${tmpStdout}" >> "${invocationLog.logPath}"
echo "---STDERR---" >> "${invocationLog.logPath}"
cat "${tmpStderr}" >> "${invocationLog.logPath}"
`;
  }

  script += `
# Output filtered stdout
cat "${tmpStdout}" | ${filter}
filter_exit=$?

# Output original stderr to stderr
cat "${tmpStderr}" >&2

# Clean up
rm -f "${tmpStdout}" "${tmpStderr}"

# Exit with filter exit code if filter failed, otherwise original exit code
if [ $filter_exit -ne 0 ]; then
  exit $filter_exit
fi
exit $cmd_exit
`;

  const result = await sandbox.executeCommand(script);

  return {
    result,
    logPath: invocationLog?.logPath,
  };
}
