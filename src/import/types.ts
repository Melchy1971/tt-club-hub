export type ImportSourceType = "csv" | "excel" | "click-tt";

export type ImportEntityType = "member" | "team" | "match";

export type ImportSeverity = "info" | "warning" | "error" | "fatal";

export type RowStatus = "success" | "partial" | "failed" | "skipped";

export type ImportIssueCode =
  | "UNKNOWN_HEADER"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_DATE"
  | "AMBIGUOUS_DATE"
  | "INVALID_RATING"
  | "AMBIGUOUS_RATING"
  | "LOW_CONFIDENCE_MATCH"
  | "DUPLICATE_RECORD"
  | "UNRESOLVED_REFERENCE"
  | "PERSISTENCE_ERROR"
  | "UNSUPPORTED_FILE";

export interface ImportIssue {
  code: ImportIssueCode;
  severity: ImportSeverity;
  message: string;
  rowIndex?: number;
  field?: string;
  rawValue?: unknown;
  context?: Record<string, unknown>;
}

export interface RowImportResult<TDraft> {
  rowIndex: number;
  entityType: ImportEntityType;
  status: RowStatus;
  draft?: TDraft;
  matchedEntityId?: string;
  issues: ImportIssue[];
}

export interface ImportMetrics {
  totalRows: number;
  successfulRows: number;
  partialRows: number;
  failedRows: number;
  skippedRows: number;
  created: number;
  updated: number;
  unchanged: number;
}

export interface ImportReport {
  sourceType: ImportSourceType;
  fileName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  metrics: ImportMetrics;
  issues: ImportIssue[];
  perRow: Array<RowImportResult<unknown>>;
}

export interface MemberDraft {
  externalId?: string;
  firstName: string;
  lastName: string;
  club?: string;
  birthDate?: string;
  gender?: string;
  ttr?: number;
  qttr?: number;
  ratingDate?: string;
}

export interface TeamDraft {
  externalId?: string;
  name: string;
  club?: string;
  league?: string;
  season?: string;
}

export interface MatchDraft {
  externalId?: string;
  homeTeam: string;
  awayTeam: string;
  matchDate?: string;
  result?: string;
  round?: string;
  season?: string;
}
