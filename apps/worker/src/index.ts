import { config as loadDotenv } from "dotenv";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { loadWorkerConfig } from "./config.js";
import { type WorkerConfig } from "./config.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

async function runPass(searchService: SearchService, config: WorkerConfig): Promise<void> {
  const [status, invalid, diagnostics] = await Promise.all([
    searchService.getVaultStatus(),
    searchService.getInvalidNotes(),
    searchService.getVaultDiagnostics()
  ]);

  const summary = {
    event: "worker.pass.completed",
    totalNotes: status.totalNotes,
    byKind: status.byKind,
    invalidCount: invalid.count,
    diagnostics: diagnostics.summary,
    skipped: invalid.notes,
    indexedAt: status.checkedAt
  };

  console.log(JSON.stringify(summary, null, 2));

  if (config.indexPath) {
    try {
      await writeFile(config.indexPath, JSON.stringify(summary, null, 2), "utf8");
    } catch (error) {
      console.error("Worker: failed to write index file.", error);
    }
  }
}

async function main() {
  const config = loadWorkerConfig();
  const vaultAdapter = new VaultAdapter({
    vaultRoot: config.vaultRoot
  });
  const searchService = new SearchService(vaultAdapter);

  await runPass(searchService, config);

  setInterval(() => {
    void runPass(searchService, config);
  }, config.pollMs);

  // TODO: Replace polling with explicit indexing jobs and queue-backed work orchestration.
}

main().catch((error) => {
  console.error("Worker failed to start.", error);
  process.exitCode = 1;
});

