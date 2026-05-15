import { describe, expect, it, vi } from "vitest";
import {
  createBashExecuteTool,
  createReadFileTool,
  createWriteFileTool,
} from "./index.js";

vi.mock("ai", () => ({
  tool: vi.fn((config) => ({
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  })),
}));

describe("public exports", () => {
  it("exports individual tool creators", () => {
    expect(createBashExecuteTool).toBeTypeOf("function");
    expect(createReadFileTool).toBeTypeOf("function");
    expect(createWriteFileTool).toBeTypeOf("function");
  });
});
