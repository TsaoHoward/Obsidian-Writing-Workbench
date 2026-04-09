import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { loadWorkerConfig } from "./config.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

async function runPass(searchService: SearchService): Promise<void> {
  const { notes, skipped } = await searchService.listNotes();

  console.log(
    JSON.stringify(
      {
        event: "worker.pass.completed",
        noteCount: notes.length,
        skippedCount: skipped.length
      },
      null,
      2
    )
  );
}

async function main() {
  const config = loadWorkerConfig();
  const vaultAdapter = new VaultAdapter({
    vaultRoot: config.vaultRoot
  });
  const searchService = new SearchService(vaultAdapter);

  await runPass(searchService);

  setInterval(() => {
    void runPass(searchService);
  }, config.pollMs);

  // TODO: Replace polling with explicit indexing jobs and queue-backed work orchestration.
}

main().catch((error) => {
  console.error("Worker failed to start.", error);
  process.exitCode = 1;
});
