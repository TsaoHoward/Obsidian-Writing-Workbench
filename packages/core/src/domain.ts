export const noteKinds = ["topic", "source", "claim", "outline", "draft"] as const;
export type NoteKind = (typeof noteKinds)[number];

export const noteStatusValues = ["seed", "active", "review", "done"] as const;
export type NoteStatus = (typeof noteStatusValues)[number];

export const sourceKindValues = [
  "article",
  "paper",
  "book",
  "podcast",
  "video",
  "website",
  "interview",
  "other"
] as const;
export type SourceKind = (typeof sourceKindValues)[number];

export const claimStanceValues = ["supporting", "counter", "open-question"] as const;
export type ClaimStance = (typeof claimStanceValues)[number];

export const outlineStageValues = ["seed", "working", "ready"] as const;
export type OutlineStage = (typeof outlineStageValues)[number];

export const draftStageValues = ["zero-draft", "revision", "polish"] as const;
export type DraftStage = (typeof draftStageValues)[number];

export type ISODateTimeString = string;

export interface BaseNoteFrontmatter {
  id: string;
  type: NoteKind;
  title: string;
  status: NoteStatus;
  tags: string[];
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface TopicNoteFrontmatter extends BaseNoteFrontmatter {
  type: "topic";
  question: string;
  scope?: string;
  sourceIds: string[];
  claimIds: string[];
  outlineIds: string[];
  draftIds: string[];
}

export interface SourceNoteFrontmatter extends BaseNoteFrontmatter {
  type: "source";
  sourceKind: SourceKind;
  authors: string[];
  url?: string;
  citation?: string;
  publishedAt?: string;
  topicIds: string[];
  claimIds: string[];
  reliability?: "high" | "medium" | "low";
}

export interface ClaimNoteFrontmatter extends BaseNoteFrontmatter {
  type: "claim";
  statement: string;
  stance: ClaimStance;
  topicIds: string[];
  sourceIds: string[];
  confidence?: number;
}

export interface OutlineNoteFrontmatter extends BaseNoteFrontmatter {
  type: "outline";
  topicId: string;
  claimIds: string[];
  sourceIds: string[];
  stage: OutlineStage;
  targetAudience?: string;
  writingGoal?: string;
}

export interface DraftNoteFrontmatter extends BaseNoteFrontmatter {
  type: "draft";
  topicId: string;
  outlineId?: string;
  claimIds: string[];
  sourceIds: string[];
  stage: DraftStage;
  targetWords?: number;
}

export type AnyNoteFrontmatter =
  | TopicNoteFrontmatter
  | SourceNoteFrontmatter
  | ClaimNoteFrontmatter
  | OutlineNoteFrontmatter
  | DraftNoteFrontmatter;

export interface NoteDocument<TFrontmatter extends BaseNoteFrontmatter = AnyNoteFrontmatter> {
  path: string;
  frontmatter: TFrontmatter;
  body: string;
}

export type TopicNote = NoteDocument<TopicNoteFrontmatter>;
export type SourceNote = NoteDocument<SourceNoteFrontmatter>;
export type ClaimNote = NoteDocument<ClaimNoteFrontmatter>;
export type OutlineNote = NoteDocument<OutlineNoteFrontmatter>;
export type DraftNote = NoteDocument<DraftNoteFrontmatter>;
export type AnyNoteDocument = NoteDocument<AnyNoteFrontmatter>;

export interface NoteSummary {
  id: string;
  type: NoteKind;
  title: string;
  path: string;
  status: NoteStatus;
  tags: string[];
  updatedAt: ISODateTimeString;
}
