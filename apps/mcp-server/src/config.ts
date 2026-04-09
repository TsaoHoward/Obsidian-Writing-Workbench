import { z } from "zod";

const mcpServerEnvSchema = z.object({
  VAULT_ROOT: z.string().trim().min(1, "VAULT_ROOT is required.")
});

export interface McpServerConfig {
  vaultRoot: string;
}

export function loadMcpServerConfig(env: NodeJS.ProcessEnv = process.env): McpServerConfig {
  const parsed = mcpServerEnvSchema.parse(env);

  return {
    vaultRoot: parsed.VAULT_ROOT
  };
}
