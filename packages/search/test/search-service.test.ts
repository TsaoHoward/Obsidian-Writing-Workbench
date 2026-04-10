import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SearchService } from "../src/search-service.js";
import { VaultAdapter } from "@oww/vault-adapter";

async function createTestVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-search-test-"));
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
sourceIds: [source-alpha]
claimIds: [claim-missing]
outlineIds: []
draftIds: []
---

Body.
`,
    "utf8"
  );

  await writeFile(
    path.join(vaultRoot, "02 Sources/source-alpha.md"),
    `---
id: source-alpha
type: source
title: Source Alpha
status: active
tags: []
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
sourceKind: article
authors: [Author One]
topicIds: [topic-test]
claimIds: [claim-one]
---

Source body.
`,
    "utf8"
  );

  await writeFile(
    path.join(vaultRoot, "03 Claims/claim-one.md"),
    `---
id: claim-one
type: claim
title: Claim One
status: review
tags: []
createdAt: 2026-04-09T00:00:00Z
updatedAt: 2026-04-09T00:00:00Z
statement: Retrieval should find related notes.
stance: supporting
topicIds: [topic-test]
sourceIds: [source-alpha]
confidence: 0.9
---

Claim body.
`,
    "utf8"
  );

  return vaultRoot;
}

describe("SearchService related notes", () => {
  it("returns related notes and missing references for a topic", async () => {
    const vaultRoot = await createTestVault();
    const service = new SearchService(new VaultAdapter({ vaultRoot }));

    try {
      const result = await service.getRelatedNotes({ noteId: "topic-test" });
      expect(result.note.id).toBe("topic-test");
      expect(result.related.map((entry) => entry.note.id)).toEqual(["source-alpha", "claim-one"]);
      expect(result.related.find((entry) => entry.note.id === "source-alpha")?.reasons).toContain("topic.sourceIds");
      expect(result.related.find((entry) => entry.note.id === "claim-one")?.reasons).toContain("claim.topicIds");
      expect(result.missingIds).toContain("claim-missing");
      expect(result.skipped).toHaveLength(0);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("reports broken links and orphaned notes in diagnostics", async () => {
    const vaultRoot = await createTestVault();
    const service = new SearchService(new VaultAdapter({ vaultRoot }));

    try {
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

      const diagnostics = await service.getVaultDiagnostics();
      expect(diagnostics.summary.brokenLinks).toBe(1);
      expect(diagnostics.summary.orphanedNotes).toBe(1);
      expect(diagnostics.issues.map((issue) => issue.code)).toContain("MISSING_LINKED_NOTE");
      expect(diagnostics.issues.map((issue) => issue.code)).toContain("ORPHANED_NOTE");
      expect(diagnostics.issues.find((issue) => issue.noteId === "topic-test")?.relatedIds).toContain("claim-missing");
      expect(diagnostics.issues.find((issue) => issue.noteId === "orphan-source")?.severity).toBe("warning");
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
