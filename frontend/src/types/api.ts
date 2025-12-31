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

export type ThinkingPayload = {
  content?: string;
  step?: string;
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
  details?: Record<string, unknown>;
};

export type EndPayload = {
  message?: string;
  total_chunks?: number;
};

export type AskChunk =
  | { type: 'thinking'; trace_id?: string; payload: ThinkingPayload }
  | { type: 'technical_view'; trace_id?: string; payload: TechnicalViewPayload }
  | { type: 'data'; trace_id?: string; payload: DataPayload }
  | { type: 'chart'; trace_id?: string; payload: ChartPayload }
  | { type: 'summary'; trace_id?: string; payload: SummaryPayload }
  | { type: 'error'; trace_id?: string; payload: ErrorPayload }
  | { type: 'end'; trace_id?: string; payload: EndPayload };

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
