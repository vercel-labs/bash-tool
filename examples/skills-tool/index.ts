/**
 * Example: Using createSkillTool with AI SDK ToolLoopAgent
 *
 * This example demonstrates how to create an AI agent with skills
 * that can process CSV and text files using bash tools.
 *
 * Run with: npx tsx examples/skills-tool/index.ts
 */

import path from "node:path";
import { ToolLoopAgent } from "ai";
import {
  createBashTool,
  experimental_createSkillTool as createSkillTool,
} from "../../src/index.js";

async function main() {
  // Discover skills and get files to upload
  const { skill, skills, files, instructions } = await createSkillTool({
    skillsDirectory: path.join(import.meta.dirname, "skills"),
  });

  console.log("Available skills:");
  for (const skill of skills) {
    console.log(`  - ${skill.name}: ${skill.description}`);
  }
  console.log("");

  // Create bash tool with skill files
  const { tools } = await createBashTool({
    files,
    extraInstructions: instructions,
  });

  // Create the agent with skills
  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      skill,
      bash: tools.bash,
    },
    instructions: `You are a data processing assistant with access to skills.
Use the skill tool to discover how to use a skill, then use bash to run its scripts.
Skills are located at ./skills/<skill-name>/.`,
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          console.log(`Tool: ${call.toolName}`);
          if (call.toolName === "skill" && "input" in call) {
            const input = call.input as { skillName: string };
            console.log(`  Loading skill: ${input.skillName}`);
          } else if (call.toolName === "bash" && "input" in call) {
            const input = call.input as { command: string };
            console.log(`  Command: ${input.command}`);
          }
        }
      }
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          if (result.toolName === "bash" && "output" in result) {
            const output = result.output as {
              stdout: string;
              exitCode: number;
            };
            if (output.stdout) {
              console.log(`  Output:\n${output.stdout.slice(0, 500)}`);
            }
          }
        }
        console.log("");
      }
    },
  });

  // Example prompt - the AI will discover and use skills as needed
  const prompt = `
    I have a CSV file with sales data. Here's the content:

    date,product,quantity,price,region
    2024-01-15,Widget A,100,29.99,North
    2024-01-15,Widget B,50,49.99,South
    2024-01-16,Widget A,75,29.99,East
    2024-01-16,Widget C,200,19.99,North
    2024-01-17,Widget B,30,49.99,West
    2024-01-17,Widget A,150,29.99,North

    Please:
    1. First, write this data to a file called sales.csv
    2. Use the csv skill to analyze the file
    3. Filter to show only North region sales
    4. Sort by quantity (highest first)
  `;

  console.log("Sending prompt to agent...\n");

  const result = await agent.generate({ prompt });

  console.log("\n=== Final Response ===\n");
  console.log(result.text);

  console.log("\n=== Agent Stats ===");
  console.log(`Steps: ${result.steps.length}`);
  console.log(`Total tokens: ${result.usage.totalTokens}`);
}

main().catch(console.error);
