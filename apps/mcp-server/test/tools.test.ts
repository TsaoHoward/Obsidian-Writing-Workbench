import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { describe, expect, it } from "vitest";
import { dispatchTool } from "../src/tools.js";

async function createTestVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-mcp-test-"));
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
    path.join(vaultRoot, "01 Topics/topic-test.md"),
    `---
id: topic-test
type: topic
title: Test Topic
status: active
tags: []
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
question: What is this about?
sourceIds: []
claimIds: []
outlineIds: []
draftIds: []
---

Body.
`,
    "utf8"
  );

  return vaultRoot;
}

function makeDeps(vaultRoot: string) {
  const vaultAdapter = new VaultAdapter({ vaultRoot });
  const searchService = new SearchService(vaultAdapter);
  return { vaultAdapter, searchService };
}

describe("MCP tool dispatcher", () => {
  it("oww.list_notes returns notes and skipped", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("list_notes", {}, makeDeps(vaultRoot));
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.notes).toHaveLength(1);
      expect(payload.skipped).toHaveLength(0);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.list_notes filters by type", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("list_notes", { type: "source" }, makeDeps(vaultRoot));
      const payload = JSON.parse(result.content[0].text);
      expect(payload.notes).toHaveLength(0);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.read_note returns a validated note", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("read_note", { path: "01 Topics/topic-test.md" }, makeDeps(vaultRoot));
      expect(result.isError).toBeFalsy();
      const note = JSON.parse(result.content[0].text);
      expect(note.frontmatter.id).toBe("topic-test");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.read_note returns error for non-existent path", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("read_note", { path: "01 Topics/missing.md" }, makeDeps(vaultRoot));
      expect(result.isError).toBe(true);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.create_claim_note persists a claim", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool(
        "create_claim_note",
        {
          title: "Canonical vaults improve portability",
          statement: "Keeping the vault canonical makes the system portable.",
          topicIds: ["topic-test"]
        },
        makeDeps(vaultRoot)
      );
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.note.frontmatter.type).toBe("claim");
      expect(payload.note.path).toBe("03 Claims/claim-canonical-vaults-improve-portability.md");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.create_source_note persists a source", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool(
        "create_source_note",
        { title: "MCP Overview", topicIds: ["topic-test"], sourceKind: "article" },
        makeDeps(vaultRoot)
      );
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.note.frontmatter.type).toBe("source");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.create_outline_note persists an outline", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool(
        "create_outline_note",
        { title: "Backend Outline", topicId: "topic-test" },
        makeDeps(vaultRoot)
      );
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.note.frontmatter.type).toBe("outline");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.create_draft_note persists a draft", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool(
        "create_draft_note",
        { title: "Backend Draft", topicId: "topic-test" },
        makeDeps(vaultRoot)
      );
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.note.frontmatter.type).toBe("draft");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.get_vault_status counts notes by kind", async () => {
    const vaultRoot = await createTestVault();
    const deps = makeDeps(vaultRoot);
    try {
      await dispatchTool("create_claim_note", {
        title: "Claim one", statement: "Statement.", topicIds: ["topic-test"]
      }, deps);
      await dispatchTool("create_source_note", {
        title: "Source one", topicIds: ["topic-test"]
      }, deps);

      const result = await dispatchTool("get_vault_status", {}, deps);
      expect(result.isError).toBeFalsy();
      const status = JSON.parse(result.content[0].text);
      expect(status.totalNotes).toBe(3);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "topic")?.count).toBe(1);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "claim")?.count).toBe(1);
      expect(status.byKind.find((k: { kind: string }) => k.kind === "source")?.count).toBe(1);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.get_policy returns the folder policy", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("get_policy", {}, makeDeps(vaultRoot));
      expect(result.isError).toBeFalsy();
      const policy = JSON.parse(result.content[0].text);
      expect(policy.writable).toContain("03 Claims/");
      expect(policy.protected).toContain("06 Finals/");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("returns error result for unknown tool name", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("nonexistent", {}, makeDeps(vaultRoot));
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.get_invalid_notes returns empty list when all notes are valid", async () => {
    const vaultRoot = await createTestVault();
    try {
      const result = await dispatchTool("get_invalid_notes", {}, makeDeps(vaultRoot));
      expect(result.isError).toBeFalsy();
      const report = JSON.parse(result.content[0].text);
      expect(report.count).toBe(0);
      expect(report.notes).toHaveLength(0);
      expect(report.checkedAt).toBeTruthy();
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.get_related_notes returns related notes and missing ids", async () => {
    const vaultRoot = await createTestVault();
    try {
      await writeFile(
        path.join(vaultRoot, "03 Claims/topic-claim.md"),
        `---
id: claim-topic-linked
type: claim
title: Topic-linked claim
status: review
tags: []
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
statement: The topic should discover linked notes.
stance: supporting
topicIds: [topic-test]
sourceIds: [source-missing]
confidence: 0.8
---

Claim body.
`,
        "utf8"
      );

      const result = await dispatchTool("get_related_notes", { id: "topic-test" }, makeDeps(vaultRoot));
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.note.id).toBe("topic-test");
      expect(payload.related.map((entry: { note: { id: string } }) => entry.note.id)).toContain("claim-topic-linked");
      expect(payload.missingIds).toContain("source-missing");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("oww.get_vault_diagnostics returns broken-link and orphan diagnostics", async () => {
    const vaultRoot = await createTestVault();
    try {
      await writeFile(
        path.join(vaultRoot, "03 Claims/missing-link-claim.md"),
        `---
id: claim-missing-link
type: claim
title: Missing-link claim
status: review
tags: []
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
statement: This claim intentionally points to a missing source.
stance: supporting
topicIds: [topic-test]
sourceIds: [source-missing]
confidence: 0.8
---

Claim body.
`,
        "utf8"
      );

      await writeFile(
        path.join(vaultRoot, "02 Sources/orphan-source.md"),
        `---
id: orphan-source
type: source
title: Orphan Source
status: seed
tags: []
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
sourceKind: website
authors: []
topicIds: []
claimIds: []
---

Orphan body.
`,
        "utf8"
      );

      const result = await dispatchTool("get_vault_diagnostics", {}, makeDeps(vaultRoot));
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.summary.brokenLinks).toBe(1);
      expect(payload.summary.orphanedNotes).toBe(1);
      expect(payload.issues.map((issue: { code: string }) => issue.code)).toContain("MISSING_LINKED_NOTE");
      expect(payload.issues.map((issue: { code: string }) => issue.code)).toContain("ORPHANED_NOTE");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
