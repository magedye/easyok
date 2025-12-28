export type TrainingItem = {
  id: number;
  question: string;
  assumptions?: string;
  sql?: string;
  schema_version: string;
  policy_version: string;
  created_by: string;
  created_at: string;
  status: string;
};

export type TrainingMetrics = {
  baseline: Record<string, unknown>;
  post_training: Record<string, unknown>;
};
