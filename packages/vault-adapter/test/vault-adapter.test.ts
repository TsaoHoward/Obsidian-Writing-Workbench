import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NoteValidationError } from "@oww/core";
import { createSourceNote } from "@oww/note-schema";
import { describe, expect, it } from "vitest";
import { VaultAdapter } from "../src/vault-adapter.js";

async function createTestVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-vault-adapter-test-"));
  const folders = [
    "00 Inbox/AI",
    "01 Topics",
    "02 Sources",
    "03 Claims",
    "04 Outlines",
    "05 Drafts",
    "06 Finals",
    "07 Templates",
    "90 Archive"
  ];

  for (const folder of folders) {
    await mkdir(path.join(vaultRoot, folder), { recursive: true });
  }

  return vaultRoot;
}

describe("VaultAdapter", () => {
  it("lists only readable markdown files and normalizes path separators", async () => {
    const vaultRoot = await createTestVault();
    const adapter = new VaultAdapter({ vaultRoot });

    try {
      await writeFile(path.join(vaultRoot, "01 Topics", "topic.md"), "---\nid: topic-test\n---\n", "utf8");
      await writeFile(path.join(vaultRoot, "02 Sources", "source.md"), "---\nid: source-test\n---\n", "utf8");
      await writeFile(path.join(vaultRoot, "07 Templates", "template.md"), "# Template\n", "utf8");

      const files = await adapter.listReadableMarkdownFiles();
      expect(files).toEqual(["01 Topics/topic.md", "02 Sources/source.md"]);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("creates, updates, and upserts notes in writable folders", async () => {
    const vaultRoot = await createTestVault();
    const adapter = new VaultAdapter({ vaultRoot });
    const created = createSourceNote(
      {
        title: "Source One",
        topicIds: ["topic-test"],
        sourceKind: "website",
        body: "Original body."
      },
      { now: new Date("2026-04-10T00:00:00.000Z") }
    );

    try {
      const saved = await adapter.createNote(created);
      expect(saved.path).toBe("02 Sources/source-source-one.md");

      await expect(adapter.createNote(created)).rejects.toMatchObject({
        code: "NOTE_ALREADY_EXISTS"
      });

      const updated = {
        ...created,
        frontmatter: {
          ...created.frontmatter,
          title: "Source One Updated",
          updatedAt: "2026-04-11T00:00:00.000Z"
        },
        body: "Updated body."
      };
      await adapter.updateNote(updated);

      const afterUpdate = await readFile(path.join(vaultRoot, created.path), "utf8");
      expect(afterUpdate).toContain("Source One Updated");
      expect(afterUpdate).toContain("Updated body.");

      const upserted = {
        ...updated,
        body: "Upserted body."
      };
      await adapter.upsertNote(upserted);

      const afterUpsert = await readFile(path.join(vaultRoot, created.path), "utf8");
      expect(afterUpsert).toContain("Upserted body.");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("rejects updateNote when the target file does not exist", async () => {
    const vaultRoot = await createTestVault();
    const adapter = new VaultAdapter({ vaultRoot });
    const missing = createSourceNote(
      {
        title: "Missing Source",
        topicIds: ["topic-test"],
        sourceKind: "website"
      },
      { now: new Date("2026-04-10T00:00:00.000Z") }
    );

    try {
      await expect(adapter.updateNote(missing)).rejects.toMatchObject({
        code: "NOTE_NOT_FOUND"
      });
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("wraps invalid note reads in NoteValidationError", async () => {
    const vaultRoot = await createTestVault();
    const adapter = new VaultAdapter({ vaultRoot });

    try {
      await writeFile(
        path.join(vaultRoot, "01 Topics", "invalid-topic.md"),
        `---
id: invalid-topic
type: topic
title: Invalid topic
status: active
tags: []
createdAt: 2026-04-10T00:00:00Z
updatedAt: 2026-04-10T00:00:00Z
sourceIds: []
claimIds: []
outlineIds: []
draftIds: []
---

Missing required question field.
`,
        "utf8"
      );

      await expect(adapter.readValidatedNote("01 Topics/invalid-topic.md")).rejects.toBeInstanceOf(NoteValidationError);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
