import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const workerEnvSchema = z.object({
  VAULT_ROOT: z.string().trim().min(1, "VAULT_ROOT is required."),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(60000)
});

export interface WorkerConfig {
  vaultRoot: string;
  pollMs: number;
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = workerEnvSchema.parse(env);

  return {
    vaultRoot: path.isAbsolute(parsed.VAULT_ROOT)
      ? parsed.VAULT_ROOT
      : path.resolve(repoRoot, parsed.VAULT_ROOT),
    pollMs: parsed.WORKER_POLL_MS
  };
}
