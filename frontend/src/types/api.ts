export type AskQuestionPayload = {
  question: string;
  top_k?: number;
  stream?: boolean;
};

export type TechnicalViewPayload = {
  sql: string;
  assumptions: string[];
  is_safe: boolean;
};

export type DataPayload =
  | Array<Record<string, unknown>>
  | {
      rows: Array<Record<string, unknown>>;
      columns?: string[];
      row_count?: number;
    };

export type ChartPayload = {
  chart_type: 'bar' | 'line' | 'pie' | string;
  x?: string;
  y?: string;
  [key: string]: unknown;
};

export type SummaryPayload = string | { text: string; metrics?: Record<string, unknown> };

export type ErrorPayload = {
  message: string;
  error_code: string;
};

export type AskChunk =
  | { type: 'technical_view'; payload: TechnicalViewPayload }
  | { type: 'data'; payload: DataPayload }
  | { type: 'chart'; payload: ChartPayload }
  | { type: 'summary'; payload: SummaryPayload }
  | { type: 'error'; payload: ErrorPayload };

export type FeedbackPayload = {
  audit_id: number;
  is_valid: boolean;
  comment?: string;
  proposed_question?: string | null;
  proposed_sql?: string | null;
};

export type TrainingItem = {
  id: number;
  type: string;
  status: string;
  created_at?: string;
  created_by?: string;
};
