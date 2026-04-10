import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { loadWorkerConfig } from "../src/config.js";
import { runRefreshJob } from "../src/refresh-job.js";

async function createTestVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-worker-test-"));
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
title: Worker Test Topic
status: active
tags: []
createdAt: 2026-04-10T00:00:00Z
updatedAt: 2026-04-10T00:00:00Z
question: How should refresh jobs run?
sourceIds: [source-missing]
claimIds: []
outlineIds: []
draftIds: []
---

Body.
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
createdAt: 2026-04-10T00:00:00Z
updatedAt: 2026-04-10T00:00:00Z
sourceKind: website
authors: []
topicIds: []
claimIds: []
---

Body.
`,
    "utf8"
  );

  return vaultRoot;
}

describe("worker refresh flow", () => {
  it("loads explicit once mode from env", () => {
    const config = loadWorkerConfig({
      VAULT_ROOT: "./sandbox/dev-vault",
      WORKER_POLL_MS: "15000",
      WORKER_RUN_MODE: "once",
      WORKER_INDEX_PATH: "./tmp/index.json"
    });

    expect(config.runMode).toBe("once");
    expect(config.pollMs).toBe(15000);
    expect(config.indexPath).toContain(path.join("tmp", "index.json"));
  });

  it("runs a refresh job and writes an index snapshot", async () => {
    const vaultRoot = await createTestVault();
    const indexPath = path.join(vaultRoot, "worker-index.json");
    const searchService = new SearchService(new VaultAdapter({ vaultRoot }));

    try {
      const result = await runRefreshJob(searchService, {
        vaultRoot,
        pollMs: 1000,
        runMode: "once",
        indexPath
      }, "manual");

      expect(result.summary.event).toBe("worker.refresh.completed");
      expect(result.summary.trigger).toBe("manual");
      expect(result.summary.diagnostics.brokenLinks).toBe(1);
      expect(result.summary.diagnostics.orphanedNotes).toBe(1);

      const saved = JSON.parse(await readFile(indexPath, "utf8"));
      expect(saved.summary.event).toBe("worker.refresh.completed");
      expect(saved.summary.trigger).toBe("manual");
      expect(saved.summary.diagnostics.orphanedNotes).toBe(1);
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
