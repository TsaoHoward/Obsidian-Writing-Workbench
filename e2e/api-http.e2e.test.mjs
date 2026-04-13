import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedDevVault } from "../packages/vault-adapter/dist/dev-vault.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function isSpawnBlocked(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EPERM");
}

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : undefined;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (!port) {
    throw new Error("Failed to allocate an ephemeral port for the API e2e test.");
  }

  return port;
}

async function waitForServer(url, child, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`API server exited before becoming healthy (exitCode=${child.exitCode}).`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for API server at ${url}.`);
}

test("seeded vault supports real HTTP calls against the built API server", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "oww-api-http-e2e-"));
  const vaultRoot = path.join(tempRoot, "dev-vault");
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  await seedDevVault({ vaultRoot, clean: true });

  let child;

  try {
    child = spawn(process.execPath, ["apps/api-server/dist/index.js"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        VAULT_ROOT: vaultRoot,
        API_HOST: "127.0.0.1",
        API_PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });

    if (isSpawnBlocked(error)) {
      t.skip("API server child-process spawning is blocked in this environment.");
      return;
    }

    throw error;
  }

  let stdoutOutput = "";
  let stderrOutput = "";
  let spawnError;

  child.stdout?.on("data", (chunk) => {
    stdoutOutput += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });
  child.on("error", (error) => {
    spawnError = error;
  });

  try {
    try {
      await waitForServer(`${baseUrl}/health`, child);
    } catch (error) {
      if (isSpawnBlocked(error) || isSpawnBlocked(spawnError)) {
        t.skip("API server child-process spawning is blocked in this environment.");
        return;
      }

      throw error;
    }

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), {
      ok: true,
      service: "api-server"
    });

    const statusBeforeResponse = await fetch(`${baseUrl}/vault/status`);
    assert.equal(statusBeforeResponse.status, 200);
    const statusBefore = await statusBeforeResponse.json();
    assert.equal(statusBefore.totalNotes, 5);

    const sourceResponse = await fetch(`${baseUrl}/sources`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Operator runbook for real HTTP verification",
        topicIds: ["topic-portable-ai-writing-backend"],
        claimIds: ["claim-vault-source-of-truth"],
        sourceKind: "article",
        authors: ["Workbench team"],
        reliability: "medium",
        body: "This note documents how to verify the API server with real network requests."
      })
    });
    assert.equal(sourceResponse.status, 201);
    const createdSource = (await sourceResponse.json()).note;

    const claimResponse = await fetch(`${baseUrl}/claims`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "HTTP e2e coverage should exercise the real listener",
        statement: "Real network requests catch integration issues that in-process inject tests can miss.",
        topicIds: ["topic-portable-ai-writing-backend"],
        sourceIds: [createdSource.frontmatter.id],
        stance: "supporting",
        confidence: 0.9
      })
    });
    assert.equal(claimResponse.status, 201);
    const createdClaim = (await claimResponse.json()).note;

    const relatedResponse = await fetch(`${baseUrl}/notes/related?id=topic-portable-ai-writing-backend`);
    assert.equal(relatedResponse.status, 200);
    const related = await relatedResponse.json();
    assert.equal(related.missingIds.length, 0);
    assert.ok(related.related.some((entry) => entry.note.id === createdSource.frontmatter.id));
    assert.ok(related.related.some((entry) => entry.note.id === createdClaim.frontmatter.id));

    const diagnosticsResponse = await fetch(`${baseUrl}/vault/diagnostics`);
    assert.equal(diagnosticsResponse.status, 200);
    const diagnostics = await diagnosticsResponse.json();
    assert.equal(diagnostics.summary.invalidNotes, 0);
    assert.equal(diagnostics.summary.brokenLinks, 0);
    assert.equal(diagnostics.summary.orphanedNotes, 0);

    const searchResponse = await fetch(`${baseUrl}/notes?query=${encodeURIComponent("real network requests")}`);
    assert.equal(searchResponse.status, 200);
    const search = await searchResponse.json();
    assert.ok(search.hits.some((hit) => hit.note.id === createdClaim.frontmatter.id));
  } catch (error) {
    if (isSpawnBlocked(error) || isSpawnBlocked(spawnError)) {
      t.skip("API server child-process spawning is blocked in this environment.");
      return;
    }

    throw error;
  } finally {
    if (child?.pid && child.exitCode === null) {
      child.kill();
      await once(child, "exit").catch(() => undefined);
    }

    await rm(tempRoot, { recursive: true, force: true });
  }

  assert.equal(stderrOutput.includes("API server failed to start."), false);
  assert.equal(stdoutOutput.includes("error"), false);
});
