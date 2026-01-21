# Skills Tool Example

This example demonstrates how to use `createSkillTool` with AI SDK's `ToolLoopAgent` to give an AI agent modular capabilities (skills) that it can discover and use on demand.

## Overview

The example includes two bash-based skills:

- **csv** - Analyze and transform CSV files using awk, cut, sort
- **text** - Analyze and search text files using grep, sed, wc

## How It Works

1. `createSkillTool` discovers skills and returns their files
2. Files are passed to `createBashTool` for sandbox upload
3. The `ToolLoopAgent`:
   - Sees available skills in the `loadSkill` tool description
   - Calls `loadSkill("csv")` to get detailed instructions
   - Uses `bash` to run the skill's scripts
   - Loops until the task is complete

## Running the Example

```bash
# From the repository root
npx tsx examples/skills-tool/index.ts
```

Requires `ANTHROPIC_API_KEY` environment variable.

## Code Overview

```typescript
import { ToolLoopAgent } from "ai";
import {
  experimental_createSkillTool as createSkillTool,
  createBashTool,
} from "bash-tool";

// Discover skills and get files
const { loadSkill, skills, files, instructions } = await createSkillTool({
  skillsDirectory: "./skills",
});

// Create bash tool with skill files
const { tools } = await createBashTool({
  files,
  extraInstructions: instructions,
});

// Create agent with both tools
const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4.5",
  tools: {
    loadSkill,
    bash: tools.bash,
  },
});

// Run the agent
const result = await agent.generate({
  prompt: "Analyze this CSV data...",
});
```

## Skill Structure

Each skill is a directory containing:

```
skills/
├── csv/
│   ├── SKILL.md      # Instructions (YAML frontmatter + markdown)
│   ├── analyze.sh    # Bash scripts
│   ├── filter.sh
│   ├── select.sh
│   └── sort.sh
└── text/
    ├── SKILL.md
    ├── stats.sh
    ├── search.sh
    ├── extract.sh
    └── wordfreq.sh
```

## Creating Your Own Skills

1. Create a directory under `skills/`
2. Add a `SKILL.md` with frontmatter:
   ```yaml
   ---
   name: my-skill
   description: What this skill does
   ---

   # Instructions for the AI

   Explain how to use the scripts...
   ```
3. Add bash scripts that the AI can execute

## Key Concepts

- **Composable**: `createSkillTool` returns files, you control the sandbox via `createBashTool`
- **ToolLoopAgent**: AI SDK's agent that automatically loops through tool calls until done
- **Progressive disclosure**: The AI only sees skill names initially, loading full instructions on demand
- **Bash-only**: Scripts use standard Unix tools (awk, sed, grep, sort, etc.)
