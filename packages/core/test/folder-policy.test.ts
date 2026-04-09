import { canReadVaultPath, canWriteVaultPath, isProtectedVaultPath } from "../src/folder-policy.js";
import { describe, expect, it } from "vitest";

describe("v1 folder policy", () => {
  it("allows reads from configured readable folders", () => {
    expect(canReadVaultPath("01 Topics/example.md")).toBe(true);
    expect(canReadVaultPath("05 Drafts/example.md")).toBe(true);
  });

  it("allows writes only to configured writable folders", () => {
    expect(canWriteVaultPath("00 Inbox/AI/example.md")).toBe(true);
    expect(canWriteVaultPath("04 Outlines/example.md")).toBe(true);
    expect(canWriteVaultPath("01 Topics/example.md")).toBe(false);
  });

  it("treats protected folders as blocked even when the path shape otherwise looks valid", () => {
    expect(isProtectedVaultPath("06 Finals/final.md")).toBe(true);
    expect(canReadVaultPath("06 Finals/final.md")).toBe(false);
    expect(canWriteVaultPath("90 Archive/old.md")).toBe(false);
  });
});
