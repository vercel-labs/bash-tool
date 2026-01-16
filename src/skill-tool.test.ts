import fs from "node:fs/promises";
import path from "node:path";
import type { ToolExecutionOptions } from "ai";
import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";
import { createSkillTool } from "./skill-tool.js";
import { createBashTool } from "./tool.js";

// AI SDK tool execute requires (args, options) - we provide test options
const opts: ToolExecutionOptions = { toolCallId: "test", messages: [] };

// Helper types for test assertions
interface LoadSkillResult {
  success: boolean;
  error?: string;
  skill?: { name: string; description: string; path: string };
  instructions?: string;
  files?: string[];
}

describe("createSkillTool", () => {
  const testDir = "/tmp/claude/test-skill-tool";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("discovers skills and returns files", async () => {
    const skillDir = path.join(testDir, "pdf-skill");
    await fs.mkdir(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: pdf
description: Process PDF files
---

# PDF Processing`,
    );

    const { loadSkill, skills, files, instructions } = await createSkillTool({
      skillsDirectory: testDir,
    });

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("pdf");
    expect(skills[0].files).toContain("SKILL.md");
    expect(loadSkill).toBeDefined();
    expect(files["skills/pdf-skill/SKILL.md"]).toContain("pdf");
    expect(instructions).toContain("/workspace/skills/pdf-skill");
  });

  it("collects all skill files", async () => {
    const skillDir = path.join(testDir, "my-skill");
    await fs.mkdir(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: my-skill
description: Test skill
---`,
    );
    await fs.writeFile(path.join(skillDir, "script.py"), 'print("hello")');

    const { files } = await createSkillTool({ skillsDirectory: testDir });

    expect(files["skills/my-skill/SKILL.md"]).toContain("my-skill");
    expect(files["skills/my-skill/script.py"]).toBe('print("hello")');
  });

  it("loadSkill returns skill instructions", async () => {
    const skillDir = path.join(testDir, "test-skill");
    await fs.mkdir(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: test
description: Test skill
---

# Instructions

These are the instructions.`,
    );

    const { loadSkill } = await createSkillTool({
      skillsDirectory: testDir,
    });

    assert(loadSkill.execute, "loadSkill.execute should be defined");
    const result = (await loadSkill.execute(
      { skillName: "test" },
      opts,
    )) as LoadSkillResult;

    expect(result.success).toBe(true);
    expect(result.instructions).toContain("# Instructions");
  });

  it("loadSkill returns error for unknown skill", async () => {
    const { loadSkill } = await createSkillTool({
      skillsDirectory: testDir,
    });

    assert(loadSkill.execute, "loadSkill.execute should be defined");
    const result = (await loadSkill.execute(
      { skillName: "nonexistent" },
      opts,
    )) as LoadSkillResult;

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("works with empty skills directory", async () => {
    const { loadSkill, skills, files, instructions } = await createSkillTool({
      skillsDirectory: testDir,
    });

    expect(skills).toHaveLength(0);
    expect(loadSkill).toBeDefined();
    expect(Object.keys(files)).toHaveLength(0);
    expect(instructions).toBe("");
  });

  it("integrates with createBashTool", async () => {
    const skillDir = path.join(testDir, "echo-skill");
    await fs.mkdir(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: echo
description: Echo utility
---`,
    );
    await fs.writeFile(
      path.join(skillDir, "test.sh"),
      'echo "hello from skill"',
    );

    // Get skill files
    const { files, instructions } = await createSkillTool({
      skillsDirectory: testDir,
    });

    // Create bash tool with skill files
    const { tools } = await createBashTool({
      files,
      extraInstructions: instructions,
    });

    assert(tools.bash.execute, "bash.execute should be defined");
    const result = (await tools.bash.execute(
      { command: "cat /workspace/skills/echo-skill/test.sh" },
      opts,
    )) as { stdout: string; stderr: string; exitCode: number };

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello from skill");
  });
});
