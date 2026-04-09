import { validateNoteDocument } from "../src/schemas.js";
import { describe, expect, it } from "vitest";

describe("validateNoteDocument", () => {
  it("normalizes YAML-style Date values into strings", () => {
    const note = validateNoteDocument({
      path: "02 Sources/date-source.md",
      frontmatter: {
        id: "source-date-test",
        type: "source",
        title: "Date normalization test",
        status: "active",
        tags: ["test"],
        createdAt: new Date("2026-04-09T00:00:00Z"),
        updatedAt: new Date("2026-04-09T01:00:00Z"),
        sourceKind: "website",
        authors: ["Example Author"],
        publishedAt: new Date("2026-01-15T00:00:00Z"),
        topicIds: [],
        claimIds: []
      },
      body: "Body"
    });

    expect(note.frontmatter.createdAt).toBe("2026-04-09T00:00:00.000Z");
    expect(note.frontmatter.updatedAt).toBe("2026-04-09T01:00:00.000Z");
    expect(note.frontmatter.publishedAt).toBe("2026-01-15T00:00:00.000Z");
  });
});
