/**
 * Dev-vault smoke checks.
 *
 * These tests run against the real sandbox/dev-vault and are intentionally excluded
 * from the default test suite (vitest.config.ts only picks up apps|packages tests).
 *
 * Run manually when you want to verify end-to-end correctness against real vault content:
 *
 *   .\node_modules\.bin\vitest.CMD run sandbox/smoke/dev-vault.smoke.test.ts
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer } from "../../apps/api-server/src/server.js";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const devVaultRoot = path.join(repoRoot, "sandbox", "dev-vault");

const config = {
  vaultRoot: devVaultRoot,
  host: "127.0.0.1",
  port: 3000
};

describe("dev-vault smoke checks", () => {
  it("GET /health returns ok", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json().ok).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("GET /policies returns writable and protected folders", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/policies" });
      expect(response.statusCode).toBe(200);
      const policy = response.json().policy;
      expect(policy.writable).toContain("03 Claims/");
      expect(policy.protected).toContain("06 Finals/");
    } finally {
      await app.close();
    }
  });

  it("GET /notes lists notes from the dev vault", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/notes" });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.notes)).toBe(true);
      expect(body.notes.length).toBeGreaterThan(0);
      expect(Array.isArray(body.skipped)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("GET /vault/status reflects dev vault contents", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/vault/status" });
      expect(response.statusCode).toBe(200);
      const status = response.json();
      expect(typeof status.totalNotes).toBe("number");
      expect(status.totalNotes).toBeGreaterThan(0);
      expect(Array.isArray(status.byKind)).toBe(true);
      expect(status.byKind).toHaveLength(5); // topic, source, claim, outline, draft
      expect(typeof status.checkedAt).toBe("string");
    } finally {
      await app.close();
    }
  });

  it("GET /vault/invalid reports any notes that failed validation", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/vault/invalid" });
      expect(response.statusCode).toBe(200);
      const report = response.json();
      expect(typeof report.count).toBe("number");
      expect(Array.isArray(report.notes)).toBe(true);
      // Log any invalid notes so they are visible in CI output.
      if (report.count > 0) {
        console.warn(`Dev vault has ${report.count} invalid note(s):`, report.notes);
      }
    } finally {
      await app.close();
    }
  });

  it("GET /notes/related returns the seeded cross-linked notes", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/notes/related?id=topic-portable-ai-writing-backend"
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.note.id).toBe("topic-portable-ai-writing-backend");
      expect(body.related).toHaveLength(4);
      expect(body.missingIds).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("GET /vault/diagnostics reports a clean seeded dev vault", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/vault/diagnostics" });
      expect(response.statusCode).toBe(200);
      const report = response.json();
      expect(report.summary.invalidNotes).toBe(0);
      expect(report.summary.brokenLinks).toBe(0);
      expect(report.summary.orphanedNotes).toBe(0);
      expect(report.issues).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("GET /notes?type=topic returns only topic notes", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({ method: "GET", url: "/notes?type=topic" });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.notes.every((n: { type: string }) => n.type === "topic")).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("GET /note reads a known dev-vault note", async () => {
    const app = buildServer(config);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/note?path=01%20Topics%2Fportable-ai-writing-backend.md"
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().note.frontmatter.type).toBe("topic");
    } finally {
      await app.close();
    }
  });
});
