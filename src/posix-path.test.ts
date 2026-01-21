import { describe, expect, it } from "vitest";
import { posixJoin, posixResolve } from "./posix-path.js";

describe("posixJoin", () => {
  it("joins simple segments", () => {
    expect(posixJoin("a", "b", "c")).toBe("a/b/c");
  });

  it("handles leading slash", () => {
    expect(posixJoin("/workspace", "src", "file.ts")).toBe(
      "/workspace/src/file.ts",
    );
  });

  it("normalizes double slashes", () => {
    expect(posixJoin("/workspace/", "/src")).toBe("/workspace/src");
  });

  it("resolves . segments", () => {
    expect(posixJoin("a", ".", "b")).toBe("a/b");
  });

  it("resolves .. segments", () => {
    expect(posixJoin("a", "b", "..", "c")).toBe("a/c");
  });

  it("handles empty segments", () => {
    expect(posixJoin("a", "", "b")).toBe("a/b");
  });
});

describe("posixResolve", () => {
  it("resolves relative path against base", () => {
    expect(posixResolve("/workspace", "src/file.ts")).toBe(
      "/workspace/src/file.ts",
    );
  });

  it("returns absolute path as-is (normalized)", () => {
    expect(posixResolve("/workspace", "/other/file.ts")).toBe("/other/file.ts");
  });

  it("handles .. in relative path", () => {
    expect(posixResolve("/workspace/src", "../file.ts")).toBe(
      "/workspace/file.ts",
    );
  });

  it("handles . in relative path", () => {
    expect(posixResolve("/workspace", "./file.ts")).toBe("/workspace/file.ts");
  });

  it("normalizes the result", () => {
    expect(posixResolve("/workspace//", "src//file.ts")).toBe(
      "/workspace/src/file.ts",
    );
  });
});
