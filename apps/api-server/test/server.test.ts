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

  it("validates notes, scaffolds templates, and creates claim notes", async () => {
    const vaultRoot = await createTestVault();
    const app = buildServer({
      vaultRoot,
      host: "127.0.0.1",
      port: 3000
    });

    try {
      const validateResponse = await app.inject({
        method: "POST",
        url: "/notes/validate",
        payload: {
          path: "02 Sources/validated-source.md",
          frontmatter: {
            id: "source-validated-source",
            type: "source",
            title: "Validated source",
            status: "active",
            tags: ["test"],
            createdAt: "2026-04-09T00:00:00Z",
            updatedAt: "2026-04-09T00:00:00Z",
            sourceKind: "website",
            authors: ["Example Author"],
            topicIds: ["topic-test"],
            claimIds: []
          },
          body: "Validated body."
        }
      });
      expect(validateResponse.statusCode).toBe(200);
      expect(validateResponse.json().valid).toBe(true);
      expect(validateResponse.json().note.frontmatter.id).toBe("source-validated-source");

      const templatePreviewResponse = await app.inject({
        method: "POST",
        url: "/notes/template",
        payload: {
          type: "topic",
          title: "Template preview topic",
          question: "What does a generated topic look like?"
        }
      });
      expect(templatePreviewResponse.statusCode).toBe(200);
      expect(templatePreviewResponse.json().persisted).toBe(false);
      expect(templatePreviewResponse.json().note.path).toBe("01 Topics/topic-template-preview-topic.md");

      const templateWriteResponse = await app.inject({
        method: "POST",
        url: "/notes/template",
        payload: {
          type: "source",
          title: "Template source",
          topicIds: ["topic-test"],
          sourceKind: "website",
          write: true
        }
      });
      expect(templateWriteResponse.statusCode).toBe(201);
      expect(templateWriteResponse.json().persisted).toBe(true);
      await expect(readFile(path.join(vaultRoot, "02 Sources/source-template-source.md"), "utf8")).resolves.toContain(
        "Template source"
      );

      const claimResponse = await app.inject({
        method: "POST",
        url: "/claims",
        payload: {
          title: "Canonical vaults improve portability",
          statement: "Keeping the vault canonical makes the system portable across clients.",
          topicIds: ["topic-test"],
          sourceIds: ["source-validated-source"]
        }
      });
      expect(claimResponse.statusCode).toBe(201);
      expect(claimResponse.json().note.frontmatter.type).toBe("claim");
      await expect(
        readFile(path.join(vaultRoot, "03 Claims/claim-canonical-vaults-improve-portability.md"), "utf8")
      ).resolves.toContain("portable across clients");
    } finally {
      await app.close();
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("creates source, outline, and draft notes and returns vault status", async () => {
    const vaultRoot = await createTestVault();
    const app = buildServer({
      vaultRoot,
      host: "127.0.0.1",
      port: 3000
    });

    try {
      const sourceResponse = await app.inject({
        method: "POST",
        url: "/sources",
        payload: {
          title: "MCP Overview",
          topicIds: ["topic-test"],
          sourceKind: "article",
          authors: ["Author One"],
          url: "https://example.com/mcp-overview"
        }
      });
      expect(sourceResponse.statusCode).toBe(201);
      expect(sourceResponse.json().note.frontmatter.type).toBe("source");

      const outlineResponse = await app.inject({
        method: "POST",
        url: "/outlines",
        payload: {
          title: "Backend architecture outline",
          topicId: "topic-test",
          stage: "seed"
        }
      });
      expect(outlineResponse.statusCode).toBe(201);
      expect(outlineResponse.json().note.frontmatter.type).toBe("outline");

      const draftResponse = await app.inject({
        method: "POST",
        url: "/drafts",
        payload: {
          title: "Backend architecture draft",
          topicId: "topic-test",
          stage: "zero-draft"
        }
      });
      expect(draftResponse.statusCode).toBe(201);
      expect(draftResponse.json().note.frontmatter.type).toBe("draft");

      const statusResponse = await app.inject({
        method: "GET",
        url: "/vault/status"
      });
      expect(statusResponse.statusCode).toBe(200);
      const status = statusResponse.json();
      expect(status.totalNotes).toBe(4); // 1 topic seed + 1 source + 1 outline + 1 draft
      expect(status.skipped).toHaveLength(0);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "topic")?.count).toBe(1);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "source")?.count).toBe(1);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "outline")?.count).toBe(1);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "draft")?.count).toBe(1);
    } finally {
      await app.close();
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
