import {
  createClaimNote,
  createDraftNote,
  createNoteFromTemplate,
  createOutlineNote,
  createSourceNote
} from "../src/factories.js";
import { describe, expect, it } from "vitest";

const FIXED_DATE = new Date("2026-04-09T12:00:00Z");
const FIXED_OPTS = { now: FIXED_DATE };

describe("note ID generation", () => {
  it("derives ID from type + slugified title", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "AI Writing Tools" }, FIXED_OPTS);
    expect(note.frontmatter.id).toBe("topic-ai-writing-tools");
  });

  it("uses custom ID when provided", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "AI Writing Tools", id: "my-custom-id" }, FIXED_OPTS);
    expect(note.frontmatter.id).toBe("my-custom-id");
  });

  it("falls back to timestamp segment when title slugifies to empty string", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "——" }, FIXED_OPTS);
    expect(note.frontmatter.id).toMatch(/^topic-\d{8}-\d{6}$/);
  });

  it("normalizes unicode in the ID slug", () => {
    // NFKD decomposes Ü→U+combining, é→e+combining, ï→i+combining;
    // combining marks (non-ASCII) are replaced with spaces, then collapsed to dashes.
    const note = createNoteFromTemplate({ type: "topic", title: "Über café naïve" }, FIXED_OPTS);
    expect(note.frontmatter.id).toBe("topic-u-ber-cafe-nai-ve");
  });

  it("collapses multiple spaces and special chars in slug", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "hello   world!!!" }, FIXED_OPTS);
    expect(note.frontmatter.id).toBe("topic-hello-world");
  });
});

describe("note path generation", () => {
  it("places topic notes in 01 Topics/", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "My Topic" }, FIXED_OPTS);
    expect(note.path).toBe("01 Topics/topic-my-topic.md");
  });

  it("places source notes in 02 Sources/", () => {
    const note = createNoteFromTemplate({ type: "source", title: "My Source", topicIds: ["t"] }, FIXED_OPTS);
    expect(note.path).toBe("02 Sources/source-my-source.md");
  });

  it("places claim notes in 03 Claims/", () => {
    const note = createNoteFromTemplate({ type: "claim", title: "My Claim" }, FIXED_OPTS);
    expect(note.path).toBe("03 Claims/claim-my-claim.md");
  });

  it("places outline notes in 04 Outlines/", () => {
    const note = createNoteFromTemplate({ type: "outline", title: "My Outline", topicId: "t" }, FIXED_OPTS);
    expect(note.path).toBe("04 Outlines/outline-my-outline.md");
  });

  it("places draft notes in 05 Drafts/", () => {
    const note = createNoteFromTemplate({ type: "draft", title: "My Draft", topicId: "t" }, FIXED_OPTS);
    expect(note.path).toBe("05 Drafts/draft-my-draft.md");
  });

  it("uses custom path when provided (adds .md extension)", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "X", path: "01 Topics/custom-name" }, FIXED_OPTS);
    expect(note.path).toBe("01 Topics/custom-name.md");
  });

  it("keeps .md extension when custom path already has it", () => {
    const note = createNoteFromTemplate(
      { type: "topic", title: "X", path: "01 Topics/custom-name.md" },
      FIXED_OPTS
    );
    expect(note.path).toBe("01 Topics/custom-name.md");
  });
});

describe("typed factory path shortcuts", () => {
  it("createClaimNote places file in 03 Claims/", () => {
    const note = createClaimNote(
      { title: "Backend is portable", statement: "It is portable.", topicIds: ["t"] },
      FIXED_OPTS
    );
    expect(note.path).toMatch(/^03 Claims\//);
    expect(note.frontmatter.type).toBe("claim");
  });

  it("createSourceNote places file in 02 Sources/", () => {
    const note = createSourceNote({ title: "Some Source", topicIds: ["t"] }, FIXED_OPTS);
    expect(note.path).toMatch(/^02 Sources\//);
    expect(note.frontmatter.type).toBe("source");
  });

  it("createOutlineNote places file in 04 Outlines/", () => {
    const note = createOutlineNote({ title: "Some Outline", topicId: "t" }, FIXED_OPTS);
    expect(note.path).toMatch(/^04 Outlines\//);
    expect(note.frontmatter.type).toBe("outline");
  });

  it("createDraftNote places file in 05 Drafts/", () => {
    const note = createDraftNote({ title: "Some Draft", topicId: "t" }, FIXED_OPTS);
    expect(note.path).toMatch(/^05 Drafts\//);
    expect(note.frontmatter.type).toBe("draft");
  });
});

describe("createdAt / updatedAt timestamps", () => {
  it("sets createdAt and updatedAt to the same ISO string at creation time", () => {
    const note = createNoteFromTemplate({ type: "topic", title: "Time Test" }, FIXED_OPTS);
    expect(note.frontmatter.createdAt).toBe("2026-04-09T12:00:00.000Z");
    expect(note.frontmatter.updatedAt).toBe("2026-04-09T12:00:00.000Z");
  });
});
