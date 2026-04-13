import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { seedDevVault } from "../packages/vault-adapter/dist/dev-vault.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function canSpawnChildProcess() {
  const probe = spawnSync(process.execPath, ["-e", "process.exit(0)"], {
    stdio: "ignore"
  });

  return !probe.error;
}

function isSpawnBlocked(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EPERM");
}

test("built MCP server supports stdio client handshake and tool calls", async (t) => {
  if (!canSpawnChildProcess()) {
    t.skip("Child-process spawning is blocked in this environment.");
    return;
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "oww-mcp-stdio-e2e-"));
  const vaultRoot = path.join(tempRoot, "dev-vault");

  await seedDevVault({ vaultRoot, clean: true });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["apps/mcp-server/dist/index.js"],
    cwd: repoRoot,
    env: {
      ...process.env,
      VAULT_ROOT: vaultRoot
    },
    stderr: "pipe"
  });

  let stderrOutput = "";
  transport.stderr?.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  const client = new Client(
    {
      name: "oww-e2e-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  try {
    try {
      await client.connect(transport);
    } catch (error) {
      if (isSpawnBlocked(error)) {
        t.skip("MCP stdio child-process spawning is blocked in this environment.");
        return;
      }

      throw error;
    }

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();
    assert.ok(toolNames.includes("list_notes"));
    assert.ok(toolNames.includes("read_note"));
    assert.ok(toolNames.includes("get_vault_diagnostics"));

    const readResult = await client.callTool({
      name: "read_note",
      arguments: {
        path: "01 Topics/portable-ai-writing-backend.md"
      }
    });
    assert.equal(readResult.isError, undefined);
    const readPayload = JSON.parse(readResult.content[0].text);
    assert.equal(readPayload.frontmatter.id, "topic-portable-ai-writing-backend");

    const relatedResult = await client.callTool({
      name: "get_related_notes",
      arguments: {
        id: "topic-portable-ai-writing-backend"
      }
    });
    assert.equal(relatedResult.isError, undefined);
    const relatedPayload = JSON.parse(relatedResult.content[0].text);
    assert.equal(relatedPayload.related.length, 4);
    assert.deepEqual(relatedPayload.missingIds, []);

    const diagnosticsResult = await client.callTool({
      name: "get_vault_diagnostics",
      arguments: {}
    });
    assert.equal(diagnosticsResult.isError, undefined);
    const diagnosticsPayload = JSON.parse(diagnosticsResult.content[0].text);
    assert.equal(diagnosticsPayload.summary.invalidNotes, 0);
    assert.equal(diagnosticsPayload.summary.brokenLinks, 0);
    assert.equal(diagnosticsPayload.summary.orphanedNotes, 0);
  } finally {
    await client.close();
    await rm(tempRoot, { recursive: true, force: true });
  }

  assert.equal(stderrOutput.trim(), "");
});
