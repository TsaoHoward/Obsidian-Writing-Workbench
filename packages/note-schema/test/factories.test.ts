import { createClaimNote, createNoteFromTemplate } from "../src/factories.js";
import { describe, expect, it } from "vitest";

describe("note factories", () => {
  it("creates a template-backed source note with a deterministic path", () => {
    const note = createNoteFromTemplate(
      {
        type: "source",
        title: "Structured Source",
        topicIds: ["topic-test"]
      },
      {
        now: new Date("2026-04-09T00:00:00Z")
      }
    );

    expect(note.path).toBe("02 Sources/source-structured-source.md");
    expect(note.frontmatter.id).toBe("source-structured-source");
    expect(note.frontmatter.type).toBe("source");
    expect(note.body).toContain("## Summary");
  });

  it("creates a writable claim note with defaults that suit the claim workflow", () => {
    const note = createClaimNote(
      {
        title: "Canonical vaults improve portability",
        statement: "Keeping the vault canonical makes the system portable across clients.",
        topicIds: ["topic-test"],
        sourceIds: ["source-test"]
      },
      {
        now: new Date("2026-04-09T00:00:00Z")
      }
    );

    expect(note.path).toBe("03 Claims/claim-canonical-vaults-improve-portability.md");
    expect(note.frontmatter.id).toBe("claim-canonical-vaults-improve-portability");
    expect(note.frontmatter.type).toBe("claim");
    expect(note.frontmatter.statement).toContain("portable across clients");
    expect(note.body).toContain("## Supporting evidence");
  });
});
