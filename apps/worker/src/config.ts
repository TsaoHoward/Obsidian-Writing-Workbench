import { z } from "zod";

const workerEnvSchema = z.object({
  VAULT_ROOT: z.string().trim().min(1, "VAULT_ROOT is required."),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(60000)
});

export interface WorkerConfig {
  vaultRoot: string;
  pollMs: number;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = workerEnvSchema.parse(env);

  return {
    vaultRoot: parsed.VAULT_ROOT,
    pollMs: parsed.WORKER_POLL_MS
  };
}
