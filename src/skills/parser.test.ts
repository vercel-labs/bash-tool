import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverSkills,
  extractBody,
  listSkillFiles,
  parseFrontmatter,
  readSkillMd,
} from "./parser.js";

describe("parseFrontmatter", () => {
  it("parses valid frontmatter", () => {
    const content = `---
name: test-skill
description: A test skill for testing
---

# Test Skill

Instructions here.`;

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: "test-skill",
      description: "A test skill for testing",
    });
  });

  it("handles quoted values", () => {
    const content = `---
name: "quoted-skill"
description: 'Single quoted description'
---`;

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: "quoted-skill",
      description: "Single quoted description",
    });
  });

  it("returns null for missing frontmatter", () => {
    const content = "# No frontmatter here";
    const result = parseFrontmatter(content);
    expect(result).toBeNull();
  });

  it("returns null for missing required fields", () => {
    const content = `---
name: only-name
---`;

    const result = parseFrontmatter(content);
    expect(result).toBeNull();
  });

  it("ignores comments in frontmatter", () => {
    const content = `---
name: skill
# This is a comment
description: A skill
---`;

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: "skill",
      description: "A skill",
    });
  });
});

describe("extractBody", () => {
  it("extracts body after frontmatter", () => {
    const content = `---
name: test
description: test
---

# Instructions

Do something.`;

    const result = extractBody(content);
    expect(result).toBe("# Instructions\n\nDo something.");
  });

  it("returns full content if no frontmatter", () => {
    const content = "# Just content";
    const result = extractBody(content);
    expect(result).toBe("# Just content");
  });
});

describe("discoverSkills", () => {
  const testDir = "/tmp/claude/test-skills";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("discovers skills in directory", async () => {
    // Create skill directories
    const skillDir1 = path.join(testDir, "pdf-skill");
    const skillDir2 = path.join(testDir, "excel-skill");

    await fs.mkdir(skillDir1);
    await fs.mkdir(skillDir2);

    await fs.writeFile(
      path.join(skillDir1, "SKILL.md"),
      `---
name: pdf
description: Process PDF files
---

# PDF Processing`,
    );

    await fs.writeFile(
      path.join(skillDir2, "SKILL.md"),
      `---
name: excel
description: Work with Excel files
---

# Excel Processing`,
    );

    const skills = await discoverSkills({
      skillsDirectory: testDir,
      sandboxDestination: "/skills",
    });

    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(["excel", "pdf"]);
    // Check sandbox paths are set correctly
    const pdfSkill = skills.find((s) => s.name === "pdf");
    expect(pdfSkill?.sandboxPath).toBe("/skills/pdf-skill");
  });

  it("skips directories without SKILL.md", async () => {
    const skillDir = path.join(testDir, "valid-skill");
    const noSkillDir = path.join(testDir, "no-skill");

    await fs.mkdir(skillDir);
    await fs.mkdir(noSkillDir);

    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: valid
description: Valid skill
---`,
    );

    // no-skill directory has no SKILL.md

    const skills = await discoverSkills({
      skillsDirectory: testDir,
      sandboxDestination: "/skills",
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("valid");
  });

  it("skips files in root directory", async () => {
    // Create a file (not directory) in the skills directory
    await fs.writeFile(path.join(testDir, "README.md"), "# Skills");

    const skillDir = path.join(testDir, "my-skill");
    await fs.mkdir(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: my-skill
description: My skill
---`,
    );

    const skills = await discoverSkills({
      skillsDirectory: testDir,
      sandboxDestination: "/skills",
    });
    expect(skills).toHaveLength(1);
  });

  it("throws for non-existent directory", async () => {
    await expect(
      discoverSkills({
        skillsDirectory: "/nonexistent/path",
        sandboxDestination: "/skills",
      }),
    ).rejects.toThrow(/Failed to read skills directory/);
  });
});

describe("readSkillMd", () => {
  const testDir = "/tmp/claude/test-read-skill";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("reads and parses SKILL.md", async () => {
    const skillMdPath = path.join(testDir, "SKILL.md");
    await fs.writeFile(
      skillMdPath,
      `---
name: test-skill
description: A test skill
---

# Test Skill

These are the instructions.`,
    );

    const result = await readSkillMd(skillMdPath);

    expect(result).not.toBeNull();
    expect(result?.metadata).toEqual({
      name: "test-skill",
      description: "A test skill",
    });
    expect(result?.body).toBe("# Test Skill\n\nThese are the instructions.");
  });

  it("returns null for non-existent file", async () => {
    const result = await readSkillMd("/nonexistent/SKILL.md");
    expect(result).toBeNull();
  });

  it("returns null for invalid SKILL.md", async () => {
    const skillMdPath = path.join(testDir, "SKILL.md");
    await fs.writeFile(skillMdPath, "# No frontmatter");

    const result = await readSkillMd(skillMdPath);
    expect(result).toBeNull();
  });
});

describe("listSkillFiles", () => {
  const testDir = "/tmp/claude/test-list-files";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("lists all files in skill directory", async () => {
    await fs.writeFile(
      path.join(testDir, "SKILL.md"),
      "---\nname: t\ndescription: t\n---",
    );
    await fs.writeFile(path.join(testDir, "script.py"), "print('hello')");

    const scriptsDir = path.join(testDir, "scripts");
    await fs.mkdir(scriptsDir);
    await fs.writeFile(path.join(scriptsDir, "helper.py"), "# helper");

    const files = await listSkillFiles(testDir);

    expect(files.sort()).toEqual([
      "SKILL.md",
      "script.py",
      "scripts/helper.py",
    ]);
  });

  it("returns empty array for non-existent directory", async () => {
    const files = await listSkillFiles("/nonexistent");
    expect(files).toEqual([]);
  });
});
