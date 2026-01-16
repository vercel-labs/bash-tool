import type { createLoadSkillTool } from "../tools/load-skill.js";

/**
 * Skill metadata parsed from SKILL.md frontmatter.
 */
export interface SkillMetadata {
  /** Unique skill name (lowercase, hyphens allowed) */
  name: string;
  /** Description of what the skill does and when to use it */
  description: string;
}

/**
 * Base skill info from discovery (without file list).
 */
export interface DiscoveredSkill extends SkillMetadata {
  /** Absolute path to the skill directory on disk */
  localPath: string;
  /** Path to the skill directory in the sandbox */
  sandboxPath: string;
}

/**
 * Full skill representation with file list.
 */
export interface Skill extends DiscoveredSkill {
  /** List of files in the skill directory (relative paths) */
  files: string[];
}

/**
 * Options for creating a skill toolkit.
 */
export interface CreateSkillToolOptions {
  /**
   * Path to the directory containing skill subdirectories.
   * Each subdirectory should contain a SKILL.md file.
   * @example "./skills" or "/path/to/skills"
   */
  skillsDirectory: string;

  /**
   * Relative path within the workspace where skills will be placed.
   * This path is relative to createBashTool's destination.
   * @default "skills"
   * @example "skills" -> files at /workspace/skills/...
   */
  destination?: string;

  /**
   * The workspace path used by createBashTool.
   * This is needed to generate correct absolute paths for the LLM.
   * @default "/workspace"
   */
  workspacePath?: string;
}

/**
 * Return type from createSkillTool.
 */
export interface SkillToolkit {
  /** Tool to load a skill's instructions into context */
  loadSkill: ReturnType<typeof createLoadSkillTool>;
  /** Registry of discovered skills */
  skills: Skill[];
  /** Files to pass to createBashTool (path -> content) */
  files: Record<string, string>;
  /** Extra instructions to pass to createBashTool */
  instructions: string;
}
