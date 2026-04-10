import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const workerEnvSchema = z.object({
  VAULT_ROOT: z.string().trim().min(1, "VAULT_ROOT is required."),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(60000),
  WORKER_INDEX_PATH: z.string().trim().optional()
});

export interface WorkerConfig {
  vaultRoot: string;
  pollMs: number;
  /** If set, the worker writes a vault index JSON file to this path after each pass. */
  indexPath?: string;
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = workerEnvSchema.parse(env);

  const resolvedIndexPath = parsed.WORKER_INDEX_PATH
    ? path.isAbsolute(parsed.WORKER_INDEX_PATH)
      ? parsed.WORKER_INDEX_PATH
      : path.resolve(repoRoot, parsed.WORKER_INDEX_PATH)
    : undefined;

  return {
    vaultRoot: path.isAbsolute(parsed.VAULT_ROOT)
      ? parsed.VAULT_ROOT
      : path.resolve(repoRoot, parsed.VAULT_ROOT),
    pollMs: parsed.WORKER_POLL_MS,
    ...(resolvedIndexPath !== undefined ? { indexPath: resolvedIndexPath } : {})
  };
}
