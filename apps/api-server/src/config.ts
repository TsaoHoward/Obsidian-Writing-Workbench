import { z } from "zod";

const apiServerEnvSchema = z.object({
  VAULT_ROOT: z.string().trim().min(1, "VAULT_ROOT is required."),
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(3000)
});

export interface ApiServerConfig {
  vaultRoot: string;
  host: string;
  port: number;
}

export function loadApiServerConfig(env: NodeJS.ProcessEnv = process.env): ApiServerConfig {
  const parsed = apiServerEnvSchema.parse(env);

  return {
    vaultRoot: parsed.VAULT_ROOT,
    host: parsed.API_HOST,
    port: parsed.API_PORT
  };
}
