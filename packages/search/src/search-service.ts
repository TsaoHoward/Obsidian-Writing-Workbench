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
  checkedAt: string;
}

export interface SearchServiceOptions {
  cacheEnabled?: boolean;
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
  snippet: string;
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

export type VaultDiagnosticSeverity = "error" | "warning" | "info";

export interface VaultDiagnosticIssue {
  severity: VaultDiagnosticSeverity;
  code: "MISSING_LINKED_NOTE" | "ORPHANED_NOTE";
  noteId: string;
  path: string;
  message: string;
  relatedIds: string[];
}

export interface VaultDiagnosticsSummary {
  totalNotes: number;
  invalidNotes: number;
  brokenLinks: number;
  orphanedNotes: number;
  issueCount: number;
}

export interface VaultDiagnosticsReport {
  summary: VaultDiagnosticsSummary;
  issues: VaultDiagnosticIssue[];
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
  private cachedLoadResult: LoadNotesResult | undefined;

  constructor(
    private readonly vaultAdapter: VaultAdapter,
    private readonly options: SearchServiceOptions = {}
  ) {}

  invalidateCache(): void {
    this.cachedLoadResult = undefined;
  }

  async refreshIndex(): Promise<LoadNotesResult> {
    const fresh = await this.scanValidatedNotes();

    if (this.options.cacheEnabled !== false) {
      this.cachedLoadResult = fresh;
    }

    return fresh;
  }

  async loadValidatedNotes(): Promise<LoadNotesResult> {
    if (this.options.cacheEnabled !== false && this.cachedLoadResult) {
      return this.cachedLoadResult;
    }

    return this.refreshIndex();
  }

  private async scanValidatedNotes(): Promise<LoadNotesResult> {
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

    return {
      notes,
      skipped,
      checkedAt: new Date().toISOString()
    };
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
        score: entry.score,
        snippet: buildSnippet(entry.note, normalizedQuery)
      }));

    return { hits, skipped };
  }

  async getRelatedNotes(options: GetRelatedNotesOptions): Promise<RelatedNotesResult> {
    const { notes, skipped, checkedAt } = await this.loadValidatedNotes();
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
      checkedAt
    };
  }

  async getVaultDiagnostics(): Promise<VaultDiagnosticsReport> {
    const { notes, skipped, checkedAt } = await this.loadValidatedNotes();
    const noteById = new Map(notes.map((note) => [note.frontmatter.id, note]));
    const inboundRefs = new Map<string, Set<string>>();
    const missingByNote = new Map<string, { note: AnyNoteDocument; ids: Set<string> }>();

    for (const note of notes) {
      for (const reference of dedupeReferences(collectReferences(note))) {
        const target = noteById.get(reference.id);
        if (!target) {
          const entry = missingByNote.get(note.frontmatter.id) ?? { note, ids: new Set<string>() };
          entry.ids.add(reference.id);
          missingByNote.set(note.frontmatter.id, entry);
          continue;
        }

        const inbound = inboundRefs.get(reference.id) ?? new Set<string>();
        inbound.add(note.frontmatter.id);
        inboundRefs.set(reference.id, inbound);
      }
    }

    const issues: VaultDiagnosticIssue[] = [];

    for (const entry of missingByNote.values()) {
      const relatedIds = Array.from(entry.ids).sort();
      issues.push({
        severity: "error",
        code: "MISSING_LINKED_NOTE",
        noteId: entry.note.frontmatter.id,
        path: entry.note.path,
        message: `References missing notes: ${relatedIds.join(", ")}`,
        relatedIds
      });
    }

    for (const note of notes) {
      const outgoingRefs = dedupeReferences(collectReferences(note));
      const inboundCount = inboundRefs.get(note.frontmatter.id)?.size ?? 0;

      if (outgoingRefs.length === 0 && inboundCount === 0) {
        issues.push({
          severity: "warning",
          code: "ORPHANED_NOTE",
          noteId: note.frontmatter.id,
          path: note.path,
          message: "Note has no incoming or outgoing links in the readable vault graph.",
          relatedIds: []
        });
      }
    }

    issues.sort(compareDiagnosticIssues);

    return {
      summary: {
        totalNotes: notes.length,
        invalidNotes: skipped.length,
        brokenLinks: issues
          .filter((issue) => issue.code === "MISSING_LINKED_NOTE")
          .reduce((sum, issue) => sum + issue.relatedIds.length, 0),
        orphanedNotes: issues.filter((issue) => issue.code === "ORPHANED_NOTE").length,
        issueCount: issues.length
      },
      issues,
      skipped,
      checkedAt
    };
  }

  async getVaultStatus(): Promise<VaultStatus> {
    const { notes, skipped, checkedAt } = await this.loadValidatedNotes();

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
      checkedAt
    };
  }

  async getInvalidNotes(): Promise<InvalidNotesReport> {
    const { skipped, checkedAt } = await this.loadValidatedNotes();
    return {
      count: skipped.length,
      notes: skipped,
      checkedAt
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

function dedupeReferences(references: NoteReference[]): NoteReference[] {
  const seen = new Set<string>();
  const unique: NoteReference[] = [];

  for (const reference of references) {
    const key = `${reference.reason}:${reference.id}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(reference);
  }

  return unique;
}

function compareDiagnosticIssues(left: VaultDiagnosticIssue, right: VaultDiagnosticIssue): number {
  const severityRank: Record<VaultDiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2
  };

  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    left.code.localeCompare(right.code) ||
    left.noteId.localeCompare(right.noteId)
  );
}

function buildSnippet(note: AnyNoteDocument, normalizedQuery: string): string {
  const candidates = [
    note.frontmatter.title,
    note.frontmatter.id,
    note.body,
    JSON.stringify(note.frontmatter)
  ];

  for (const candidate of candidates) {
    const lowered = candidate.toLowerCase();
    const index = lowered.indexOf(normalizedQuery);
    if (index >= 0) {
      const start = Math.max(0, index - 30);
      const end = Math.min(candidate.length, index + normalizedQuery.length + 50);
      return candidate.slice(start, end).replace(/\s+/g, " ").trim().toLowerCase();
    }
  }

  const fallback = note.body.trim() || note.frontmatter.title;
  return fallback.slice(0, 120).replace(/\s+/g, " ").trim();
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
