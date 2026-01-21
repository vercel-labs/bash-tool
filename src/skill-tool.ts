import fs from "node:fs/promises";
import path from "node:path";
import { discoverSkills, listSkillFiles } from "./skills/parser.js";
import type {
  CreateSkillToolOptions,
  Skill,
  SkillToolkit,
} from "./skills/types.js";
import { createLoadSkillTool } from "./tools/load-skill.js";

const DEFAULT_DESTINATION = "skills";

/**
 * Creates a skill toolkit for AI agents.
 *
 * Skills are modular capabilities that extend agent functionality.
 * Each skill is a directory containing a SKILL.md file with instructions
 * and optional scripts/resources.
 *
 * @example
 * ```typescript
 * import {
 *   experimental_createSkillTool as createSkillTool,
 *   createBashTool,
 * } from "bash-tool";
 *
 * // Discover skills and get files
 * const { loadSkill, skills, files, instructions } = await createSkillTool({
 *   skillsDirectory: "./skills",
 * });
 *
 * // Create bash tool with skill files
 * const { tools, sandbox } = await createBashTool({
 *   files,
 *   extraInstructions: instructions,
 * });
 *
 * // Use with AI SDK
 * const result = await generateText({
 *   model,
 *   tools: { loadSkill, ...tools },
 *   prompt: "Process this data using the csv skill",
 * });
 * ```
 */
export async function experimental_createSkillTool(
  options: CreateSkillToolOptions,
): Promise<SkillToolkit> {
  const { skillsDirectory, destination = DEFAULT_DESTINATION } = options;

  // Discover all skills and collect their files
  // sandboxDestination uses explicit relative path (e.g., "./skills") - works with any destination
  const relativeDestination = `./${destination}`;
  const discoveredSkills = await discoverSkills({
    skillsDirectory,
    sandboxDestination: relativeDestination,
  });

  // Enrich skills with file lists and collect all files
  const skills: Skill[] = [];
  const allFiles: Record<string, string> = {};

  for (const skill of discoveredSkills) {
    const skillFiles = await listSkillFiles(skill.localPath);

    // Add to skills with file list
    skills.push({
      ...skill,
      files: skillFiles,
    });

    // Read and collect all files for this skill
    const skillDirName = path.basename(skill.localPath);
    for (const file of skillFiles) {
      const localFilePath = path.join(skill.localPath, file);
      const relativeFilePath = `./${path.posix.join(destination, skillDirName, file)}`;

      try {
        const content = await fs.readFile(localFilePath, "utf-8");
        allFiles[relativeFilePath] = content;
      } catch {
        // Skip files that can't be read as text
      }
    }
  }

  // Create loadSkill tool
  const loadSkill = createLoadSkillTool({ skills });

  // Generate instructions for bash tool
  const instructions = generateSkillInstructions(skills);

  return {
    loadSkill,
    skills,
    files: allFiles,
    instructions,
  };
}

/**
 * Generate bash tool instructions that include skill paths.
 */
function generateSkillInstructions(skills: Skill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines = [
    "SKILL DIRECTORIES:",
    "Skills are available at the following paths:",
  ];

  for (const skill of skills) {
    lines.push(`  ${skill.sandboxPath}/ - ${skill.name}: ${skill.description}`);
  }

  lines.push("");
  lines.push("To use a skill:");
  lines.push("  1. Call loadSkill to get the skill's instructions");
  lines.push("  2. Run scripts from the skill directory with bash");

  return lines.join("\n");
}
