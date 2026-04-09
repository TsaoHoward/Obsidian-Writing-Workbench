import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildServer } from "../src/server.js";
import { describe, expect, it } from "vitest";

async function createTestVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-api-test-"));
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

  await writeFile(
    path.join(vaultRoot, "01 Topics/topic.md"),
    `---
id: topic-test
type: topic
title: Test topic
status: active
tags:
  - test
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
question: What should this backend do?
scope: API smoke test
sourceIds: []
claimIds: []
outlineIds: []
draftIds: []
---

Body text.
`,
    "utf8"
  );

  return vaultRoot;
}

describe("API server", () => {
  it("lists notes, reads a note, allows writes in writable folders, and blocks protected writes", async () => {
    const vaultRoot = await createTestVault();
    const app = buildServer({
      vaultRoot,
      host: "127.0.0.1",
      port: 3000
    });

    try {
      const notesResponse = await app.inject({
        method: "GET",
        url: "/notes"
      });
      expect(notesResponse.statusCode).toBe(200);
      expect(notesResponse.json().notes).toHaveLength(1);
      expect(notesResponse.json().skipped).toHaveLength(0);

      const noteResponse = await app.inject({
        method: "GET",
        url: "/note?path=01%20Topics/topic.md"
      });
      expect(noteResponse.statusCode).toBe(200);
      expect(noteResponse.json().note.frontmatter.id).toBe("topic-test");

      const allowedWriteResponse = await app.inject({
        method: "PUT",
        url: "/note",
        payload: {
          path: "00 Inbox/AI/test-draft.md",
          frontmatter: {
            id: "draft-test",
            type: "draft",
            title: "Draft test",
            status: "seed",
            tags: ["test"],
            createdAt: "2026-04-09T00:00:00Z",
            updatedAt: "2026-04-09T00:00:00Z",
            topicId: "topic-test",
            claimIds: [],
            sourceIds: [],
            stage: "zero-draft"
          },
          body: "Draft body."
        }
      });
      expect(allowedWriteResponse.statusCode).toBe(200);
      await expect(readFile(path.join(vaultRoot, "00 Inbox/AI/test-draft.md"), "utf8")).resolves.toContain(
        "Draft test"
      );

      const blockedWriteResponse = await app.inject({
        method: "PUT",
        url: "/note",
        payload: {
          path: "06 Finals/blocked.md",
          frontmatter: {
            id: "draft-blocked",
            type: "draft",
            title: "Blocked draft",
            status: "seed",
            tags: ["test"],
            createdAt: "2026-04-09T00:00:00Z",
            updatedAt: "2026-04-09T00:00:00Z",
            topicId: "topic-test",
            claimIds: [],
            sourceIds: [],
            stage: "zero-draft"
          },
          body: "Blocked."
        }
      });
      expect(blockedWriteResponse.statusCode).toBe(403);
      expect(blockedWriteResponse.json().error).toBe("PolicyViolationError");
    } finally {
      await app.close();
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
