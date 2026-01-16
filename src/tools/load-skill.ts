import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { extractBody } from "../skills/parser.js";
import type { Skill } from "../skills/types.js";

const loadSkillSchema = z.object({
  skillName: z.string().describe("The name of the skill to load"),
});

export interface CreateLoadSkillToolOptions {
  /** Registry of discovered skills */
  skills: Skill[];
}

function generateDescription(skills: Skill[]): string {
  const lines: string[] = [
    "Load a skill's instructions to learn how to use it.",
    "You can load multiple skills - each call returns that skill's instructions.",
    "",
    "Available skills:",
  ];

  if (skills.length === 0) {
    lines.push("  (no skills found)");
  } else {
    for (const skill of skills) {
      lines.push(`  - ${skill.name}: ${skill.description}`);
    }
  }

  lines.push("");
  lines.push(
    "After loading a skill, use the bash tool to run its scripts from the skill's directory.",
  );

  return lines.join("\n");
}

export function createLoadSkillTool(options: CreateLoadSkillToolOptions) {
  const { skills } = options;

  // Create a map for quick lookup
  const skillMap = new Map<string, Skill>();
  for (const skill of skills) {
    skillMap.set(skill.name, skill);
  }

  return tool({
    description: generateDescription(skills),
    inputSchema: loadSkillSchema,
    execute: async ({ skillName }) => {
      const skill = skillMap.get(skillName);

      if (!skill) {
        const availableNames = skills.map((s) => s.name).join(", ");
        return {
          success: false,
          error: `Skill "${skillName}" not found. Available skills: ${availableNames || "none"}`,
        };
      }

      // Read the SKILL.md from local filesystem
      const skillMdPath = path.join(skill.localPath, "SKILL.md");

      try {
        const content = await fs.readFile(skillMdPath, "utf-8");
        const body = extractBody(content);

        // Get files list (excluding SKILL.md)
        const files = skill.files.filter((f) => f !== "SKILL.md");

        return {
          success: true,
          skill: {
            name: skill.name,
            description: skill.description,
            path: skill.sandboxPath,
          },
          instructions: body,
          files,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to read skill "${skillName}": ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
