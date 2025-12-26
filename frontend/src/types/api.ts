export type AskQuestionPayload = {
  question: string;
  top_k?: number;
  stream?: boolean;
};

export type AskChunk =
  | {
      type: 'technical_view';
      payload: {
        sql: string;
        assumptions: string[];
        is_safe: boolean;
      };
    }
  | {
      type: 'data';
      payload: Array<Record<string, unknown>>;
    }
  | {
      type: 'chart';
      payload: {
        chart_type: 'bar' | 'line' | 'pie' | string;
        x: string;
        y: string;
      };
    }
  | {
      type: 'summary';
      payload: string;
    }
  | {
      type: 'error';
      payload: {
        message: string;
        error_code: string;
      };
    };
