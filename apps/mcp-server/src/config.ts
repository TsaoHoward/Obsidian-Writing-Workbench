import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const mcpServerEnvSchema = z.object({
  VAULT_ROOT: z.string().trim().min(1, "VAULT_ROOT is required.")
});

export interface McpServerConfig {
  vaultRoot: string;
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function loadMcpServerConfig(env: NodeJS.ProcessEnv = process.env): McpServerConfig {
  const parsed = mcpServerEnvSchema.parse(env);

  return {
    vaultRoot: path.isAbsolute(parsed.VAULT_ROOT)
      ? parsed.VAULT_ROOT
      : path.resolve(repoRoot, parsed.VAULT_ROOT)
  };
}
