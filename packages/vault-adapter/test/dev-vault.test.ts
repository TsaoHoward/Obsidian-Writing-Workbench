import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SearchService } from "@oww/search";
import { DEV_VAULT_FOLDERS, seedDevVault, VaultAdapter } from "../src/index.js";

describe("seedDevVault", () => {
  it("creates the standard dev vault structure, notes, and template files", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "oww-seed-dev-vault-"));
    const vaultRoot = path.join(tempRoot, "sandbox", "dev-vault");

    try {
      const result = await seedDevVault({ vaultRoot });

      expect(result.notePaths).toHaveLength(5);
      expect(result.templatePaths).toHaveLength(5);

      for (const folder of DEV_VAULT_FOLDERS) {
        await expect(access(path.join(vaultRoot, folder))).resolves.toBeUndefined();
      }

      await expect(access(path.join(vaultRoot, "01 Topics", "portable-ai-writing-backend.md"))).resolves.toBeUndefined();
      await expect(access(path.join(vaultRoot, "07 Templates", "topic-template.md"))).resolves.toBeUndefined();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("produces a clean related-note graph for smoke and demo usage", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "oww-seed-dev-vault-"));
    const vaultRoot = path.join(tempRoot, "sandbox", "dev-vault");
    const topicId = "topic-portable-ai-writing-backend";

    try {
      await seedDevVault({ vaultRoot });
      const searchService = new SearchService(new VaultAdapter({ vaultRoot }));

      const status = await searchService.getVaultStatus();
      expect(status.totalNotes).toBe(5);
      expect(status.byKind.every((entry: { count: number }) => entry.count === 1)).toBe(true);

      const invalid = await searchService.getInvalidNotes();
      expect(invalid.count).toBe(0);

      const related = await searchService.getRelatedNotes({ noteId: topicId });
      expect(related.related).toHaveLength(4);
      expect(related.related.map((entry: { note: { id: string } }) => entry.note.id).sort()).toEqual([
        "claim-vault-source-of-truth",
        "draft-portable-backend-v1",
        "outline-portable-backend",
        "source-mcp-spec"
      ]);
      expect(related.missingIds).toEqual([]);

      const diagnostics = await searchService.getVaultDiagnostics();
      expect(diagnostics.summary.brokenLinks).toBe(0);
      expect(diagnostics.summary.orphanedNotes).toBe(0);
      expect(diagnostics.issues).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
