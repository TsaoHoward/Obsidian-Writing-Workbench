import { WorkbenchError, type AnyNoteDocument, type NoteKind, type NoteSummary, noteKinds } from "@oww/core";
import { toNoteSummary } from "@oww/note-schema";
import { VaultAdapter } from "@oww/vault-adapter";

export interface SkippedNote {
  path: string;
  /** Machine-readable error code (e.g. NOTE_VALIDATION_ERROR, VAULT_PATH_ERROR, UNKNOWN_ERROR). */
  code: string;
  reason: string;
}

export interface LoadNotesResult {
  notes: AnyNoteDocument[];
  skipped: SkippedNote[];
}

export interface ListNotesOptions {
  type?: NoteKind;
  limit?: number;
}

export interface SearchNotesOptions extends ListNotesOptions {
  query: string;
}

export interface SearchHit {
  note: NoteSummary;
  score: number;
}

export interface SearchNotesResult {
  hits: SearchHit[];
  skipped: SkippedNote[];
}

export interface GetRelatedNotesOptions {
  noteId?: string;
  path?: string;
  limit?: number;
}

export interface RelatedNoteHit {
  note: NoteSummary;
  reasons: string[];
  score: number;
}

export interface RelatedNotesResult {
  note: NoteSummary;
  related: RelatedNoteHit[];
  missingIds: string[];
  skipped: SkippedNote[];
  checkedAt: string;
}

export interface NoteKindCount {
  kind: NoteKind;
  count: number;
}

export interface VaultStatus {
  totalNotes: number;
  byKind: NoteKindCount[];
  skipped: SkippedNote[];
  checkedAt: string;
}

export interface InvalidNotesReport {
  count: number;
  notes: SkippedNote[];
  checkedAt: string;
}

interface NoteReference {
  id: string;
  reason: string;
}

interface RelatedAccumulator {
  note: AnyNoteDocument;
  reasons: Set<string>;
  score: number;
}

export class SearchService {
  constructor(private readonly vaultAdapter: VaultAdapter) {}

  async loadValidatedNotes(): Promise<LoadNotesResult> {
    const paths = await this.vaultAdapter.listReadableMarkdownFiles();
    const notes: AnyNoteDocument[] = [];
    const skipped: SkippedNote[] = [];

    for (const notePath of paths) {
      try {
        notes.push(await this.vaultAdapter.readValidatedNote(notePath));
      } catch (error) {
        skipped.push({
          path: notePath,
          code: error instanceof WorkbenchError ? error.code : "UNKNOWN_ERROR",
          reason: error instanceof Error ? error.message : "Unknown validation error"
        });
      }
    }

    return { notes, skipped };
  }

  async listNotes(options: ListNotesOptions = {}): Promise<{ notes: NoteSummary[]; skipped: SkippedNote[] }> {
    const { notes, skipped } = await this.loadValidatedNotes();
    const filtered = options.type ? notes.filter((note) => note.frontmatter.type === options.type) : notes;
    const limited = typeof options.limit === "number" ? filtered.slice(0, options.limit) : filtered;

    return {
      notes: limited.map(toNoteSummary),
      skipped
    };
  }

  async searchNotes(options: SearchNotesOptions): Promise<SearchNotesResult> {
    const normalizedQuery = options.query.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
      return {
        hits: [],
        skipped: []
      };
    }

    const { notes, skipped } = await this.loadValidatedNotes();
    const filtered = options.type ? notes.filter((note) => note.frontmatter.type === options.type) : notes;
    const hits = filtered
      .map((note) => ({
        note,
        score: scoreNote(note, normalizedQuery)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.note.frontmatter.title.localeCompare(right.note.frontmatter.title))
      .slice(0, options.limit ?? 20)
      .map((entry) => ({
        note: toNoteSummary(entry.note),
        score: entry.score
      }));

    return { hits, skipped };
  }

  async getRelatedNotes(options: GetRelatedNotesOptions): Promise<RelatedNotesResult> {
    const { notes, skipped } = await this.loadValidatedNotes();
    const seed = resolveRequestedNote(notes, options);
    const noteById = new Map(notes.map((note) => [note.frontmatter.id, note]));
    const related = new Map<string, RelatedAccumulator>();
    const missingIds = new Set<string>();

    const recordRelation = (note: AnyNoteDocument, reason: string, score: number) => {
      if (note.frontmatter.id === seed.frontmatter.id) {
        return;
      }

      const existing = related.get(note.frontmatter.id) ?? {
        note,
        reasons: new Set<string>(),
        score: 0
      };

      existing.reasons.add(reason);
      existing.score += score;
      related.set(note.frontmatter.id, existing);
    };

    for (const reference of collectReferences(seed)) {
      const target = noteById.get(reference.id);
      if (!target) {
        missingIds.add(reference.id);
        continue;
      }

      recordRelation(target, reference.reason, 4);
    }

    for (const note of notes) {
      if (note.frontmatter.id === seed.frontmatter.id) {
        continue;
      }

      for (const reference of collectReferences(note)) {
        if (reference.id === seed.frontmatter.id) {
          recordRelation(note, reference.reason, 3);
        }
      }
    }

    for (const entry of related.values()) {
      for (const reference of collectReferences(entry.note)) {
        if (!noteById.has(reference.id)) {
          missingIds.add(reference.id);
        }
      }
    }

    return {
      note: toNoteSummary(seed),
      related: Array.from(related.values())
        .sort((left, right) => right.score - left.score || left.note.frontmatter.title.localeCompare(right.note.frontmatter.title))
        .slice(0, options.limit ?? 20)
        .map((entry) => ({
          note: toNoteSummary(entry.note),
          reasons: Array.from(entry.reasons).sort(),
          score: entry.score
        })),
      missingIds: Array.from(missingIds).sort(),
      skipped,
      checkedAt: new Date().toISOString()
    };
  }

  async getVaultStatus(): Promise<VaultStatus> {
    const { notes, skipped } = await this.loadValidatedNotes();

    const counts = new Map<NoteKind, number>();
    for (const kind of noteKinds) {
      counts.set(kind, 0);
    }
    for (const note of notes) {
      const kind = note.frontmatter.type;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }

    return {
      totalNotes: notes.length,
      byKind: noteKinds.map((kind) => ({ kind, count: counts.get(kind) ?? 0 })),
      skipped,
      checkedAt: new Date().toISOString()
    };
  }

  async getInvalidNotes(): Promise<InvalidNotesReport> {
    const { skipped } = await this.loadValidatedNotes();
    return {
      count: skipped.length,
      notes: skipped,
      checkedAt: new Date().toISOString()
    };
  }
}

function resolveRequestedNote(notes: AnyNoteDocument[], options: GetRelatedNotesOptions): AnyNoteDocument {
  if (!options.noteId && !options.path) {
    throw new WorkbenchError("Either noteId or path is required to find related notes.", "INVALID_RELATED_NOTE_QUERY");
  }

  const match = notes.find((note) => {
    if (options.noteId && note.frontmatter.id === options.noteId) {
      return true;
    }

    if (options.path && note.path === options.path) {
      return true;
    }

    return false;
  });

  if (!match) {
    throw new WorkbenchError("Requested note was not found in readable notes.", "NOTE_NOT_FOUND", {
      noteId: options.noteId,
      path: options.path
    });
  }

  return match;
}

function collectReferences(note: AnyNoteDocument): NoteReference[] {
  switch (note.frontmatter.type) {
    case "topic":
      return [
        ...note.frontmatter.sourceIds.map((id) => ({ id, reason: "topic.sourceIds" })),
        ...note.frontmatter.claimIds.map((id) => ({ id, reason: "topic.claimIds" })),
        ...note.frontmatter.outlineIds.map((id) => ({ id, reason: "topic.outlineIds" })),
        ...note.frontmatter.draftIds.map((id) => ({ id, reason: "topic.draftIds" }))
      ];

    case "source":
      return [
        ...note.frontmatter.topicIds.map((id) => ({ id, reason: "source.topicIds" })),
        ...note.frontmatter.claimIds.map((id) => ({ id, reason: "source.claimIds" }))
      ];

    case "claim":
      return [
        ...note.frontmatter.topicIds.map((id) => ({ id, reason: "claim.topicIds" })),
        ...note.frontmatter.sourceIds.map((id) => ({ id, reason: "claim.sourceIds" }))
      ];

    case "outline":
      return [
        { id: note.frontmatter.topicId, reason: "outline.topicId" },
        ...note.frontmatter.claimIds.map((id) => ({ id, reason: "outline.claimIds" })),
        ...note.frontmatter.sourceIds.map((id) => ({ id, reason: "outline.sourceIds" }))
      ];

    case "draft":
      return [
        { id: note.frontmatter.topicId, reason: "draft.topicId" },
        ...(note.frontmatter.outlineId ? [{ id: note.frontmatter.outlineId, reason: "draft.outlineId" }] : []),
        ...note.frontmatter.claimIds.map((id) => ({ id, reason: "draft.claimIds" })),
        ...note.frontmatter.sourceIds.map((id) => ({ id, reason: "draft.sourceIds" }))
      ];
  }
}

function scoreNote(note: AnyNoteDocument, normalizedQuery: string): number {
  const title = note.frontmatter.title.toLowerCase();
  const id = note.frontmatter.id.toLowerCase();
  const tags = note.frontmatter.tags.join(" ").toLowerCase();
  const frontmatter = JSON.stringify(note.frontmatter).toLowerCase();
  const body = note.body.toLowerCase();

  let score = 0;

  if (id === normalizedQuery) score += 10;
  else if (id.includes(normalizedQuery)) score += 6;

  if (title === normalizedQuery) score += 8;
  else if (title.includes(normalizedQuery)) score += 5;

  if (tags.includes(normalizedQuery)) score += 3;
  if (frontmatter.includes(normalizedQuery)) score += 2;
  if (body.includes(normalizedQuery)) score += 1;

  return score;
}

// TODO: Replace scan-on-every-request with an index-backed search pipeline in a future worker pass.
