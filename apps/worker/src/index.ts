import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { loadWorkerConfig, type WorkerConfig, type WorkerRunMode } from "./config.js";
import { runRefreshJob } from "./refresh-job.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

function resolveRunMode(argv: string[], defaultMode: WorkerRunMode): WorkerRunMode {
  if (argv.includes("--once")) {
    return "once";
  }

  if (argv.includes("--watch")) {
    return "watch";
  }

  return defaultMode;
}

function withResolvedRunMode(config: WorkerConfig, argv: string[]): WorkerConfig {
  return {
    ...config,
    runMode: resolveRunMode(argv, config.runMode)
  };
}

async function main(argv = process.argv.slice(2)) {
  const config = withResolvedRunMode(loadWorkerConfig(), argv);
  const vaultAdapter = new VaultAdapter({
    vaultRoot: config.vaultRoot
  });
  const searchService = new SearchService(vaultAdapter);

  await runRefreshJob(searchService, config, "startup");

  if (config.runMode === "once") {
    return;
  }

  setInterval(() => {
    void runRefreshJob(searchService, config, "interval");
  }, config.pollMs);
}

main().catch((error) => {
  console.error("Worker failed to start.", error);
  process.exitCode = 1;
});

