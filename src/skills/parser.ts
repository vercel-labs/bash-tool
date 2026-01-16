import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { DiscoveredSkill, SkillMetadata } from "./types.js";

/**
 * Parse YAML frontmatter from SKILL.md content using gray-matter.
 */
export function parseFrontmatter(content: string): SkillMetadata | null {
  try {
    const { data } = matter(content);

    // Validate required fields
    if (
      typeof data.name !== "string" ||
      typeof data.description !== "string" ||
      !data.name ||
      !data.description
    ) {
      return null;
    }

    return {
      name: data.name,
      description: data.description,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the body (instructions) from SKILL.md content.
 * This is everything after the frontmatter.
 */
export function extractBody(content: string): string {
  try {
    const { content: body } = matter(content);
    return body.trim();
  } catch {
    return content.trim();
  }
}

export interface DiscoverSkillsOptions {
  /** Local directory containing skill subdirectories */
  skillsDirectory: string;
  /** Base path in sandbox where skills will be uploaded */
  sandboxDestination: string;
}

/**
 * Discover all skills in a directory.
 * Looks for subdirectories containing SKILL.md files.
 */
export async function discoverSkills(
  options: DiscoverSkillsOptions,
): Promise<DiscoveredSkill[]> {
  const { skillsDirectory, sandboxDestination } = options;
  const skills: DiscoveredSkill[] = [];
  const absoluteDir = path.resolve(skillsDirectory);

  let entries: string[];
  try {
    entries = await fs.readdir(absoluteDir);
  } catch (error) {
    throw new Error(
      `Failed to read skills directory: ${absoluteDir}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  for (const entryName of entries) {
    const skillDir = path.join(absoluteDir, entryName);

    // Check if it's a directory
    try {
      const stat = await fs.stat(skillDir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const skillMdPath = path.join(skillDir, "SKILL.md");

    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      const metadata = parseFrontmatter(content);

      if (metadata) {
        skills.push({
          ...metadata,
          localPath: skillDir,
          sandboxPath: `${sandboxDestination}/${entryName}`,
        });
      }
    } catch {}
  }

  return skills;
}

/**
 * Read and parse a SKILL.md file, returning both metadata and body.
 */
export async function readSkillMd(
  skillMdPath: string,
): Promise<{ metadata: SkillMetadata; body: string } | null> {
  try {
    const content = await fs.readFile(skillMdPath, "utf-8");
    const metadata = parseFrontmatter(content);

    if (!metadata) {
      return null;
    }

    return {
      metadata,
      body: extractBody(content),
    };
  } catch {
    return null;
  }
}

/**
 * List files in a skill directory (for listing available scripts).
 */
export async function listSkillFiles(skillPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walkDir(dir: string, prefix = ""): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walkDir(path.join(dir, entry.name), relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  try {
    await walkDir(skillPath);
  } catch {
    // Return empty if directory doesn't exist
  }

  return files;
}
