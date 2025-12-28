// ----------------------------------
// EasyData TypeScript SDK — Types & Models
// Target: Web / Node / React
// Compatibility: OpenAPI final.yaml (Canonical)
// ----------------------------------

// Enums
export type ConfidenceTier =
  | "TIER_0_FORTRESS"
  | "TIER_1_LAB";

export type AssetVisibility =
  | "private"
  | "shared";

export type DeliveryChannel =
  | "email"
  | "dashboard";

// Core Requests
export interface AskRequest {
  question: string;
  stream: boolean;
  context?: Record<string, any>;
}

export interface TrainingItemRequest {
  content: string;
  metadata?: Record<string, any>;
}

export interface QueryAssetCreate {
  trace_id: string;
  title: string;
  visibility?: AssetVisibility;
}

export interface ScheduleCreate {
  asset_id: string;
  cron: string;
  delivery?: DeliveryChannel[];
}

export interface FeatureToggle {
  feature: string;
  enabled: boolean;
  reason: string;
}

export interface SandboxPromotion {
  discovery_id: string;
  reason: string;
}

// NDJSON Base & Chunks
export interface BaseChunk {
  type: string;
  trace_id: string;
  confidence_tier: ConfidenceTier;
  timestamp: string;
}

export interface ThinkingChunk extends BaseChunk {
  type: "thinking";
  status: string;
}

export interface TechnicalViewChunk extends BaseChunk {
  type: "technical_view";
  sql: string;
  assumptions: string[];
  policy_hash: string;
}

export interface DataChunk extends BaseChunk {
  type: "data_chunk";
  columns: string[];
  rows: any[][];
  row_count: number;
}

export interface BusinessViewChunk extends BaseChunk {
  type: "business_view";
  summary: string;
  chart_config: Record<string, any>;
}

export interface EndChunk extends BaseChunk {
  type: "end";
  duration_ms: number;
}

export interface ErrorChunk extends BaseChunk {
  type: "error";
  error_code: string;
  message: string;
}

export interface ExplanationChunk extends BaseChunk {
  type: "explanation_chunk";
  payload: {
    sql: string | null;
    explanation: string;
  };
}

export interface ChartSuggestionChunk extends BaseChunk {
  type: "chart_suggestion_chunk";
  payload: {
    chart: Record<string, any>;
    source: "advisory";
  };
}

export type NDJSONChunk =
  | ThinkingChunk
  | TechnicalViewChunk
  | DataChunk
  | BusinessViewChunk
  | EndChunk
  | ErrorChunk
  | ExplanationChunk
  | ChartSuggestionChunk;
