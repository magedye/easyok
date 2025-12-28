// -----------------------
// Core / Observability
// -----------------------

export interface RootDiscoveryResponse {
  message: string
  docs: string
  openapi: string
  health: string
  metrics: string
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface DependenciesStatus {
  postgres: boolean
  redis: boolean
  chroma: boolean
}

export interface FeaturesStatus {
  circuitBreaker: boolean
  correlationIds: boolean
  failover: boolean
}

export interface HealthResponse {
  status: HealthStatus
  version: string
  providersActive: number
  dependencies: DependenciesStatus
  features: FeaturesStatus
}

export interface MetricsAppInfo {
  name: string
  version: string
}

export interface MetricsSnapshot {
  appInfo: MetricsAppInfo
  providersTotal: number
  serviceStatus: HealthStatus
  dependencies: DependenciesStatus
  features: FeaturesStatus
}

// -----------------------
// User & Authentication
// -----------------------

export type UserRole = 'viewer' | 'analyst' | 'admin'

export interface User {
  userId: string
  username: string
  role?: UserRole
  fullName?: string
  recoveryEmail?: string | null
  status?: 'active' | 'disabled' | 'pending'
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface SignupRequest {
  username: string
  password: string
  fullName: string
  recoveryEmail?: string | null
}

export interface SignupResponse {
  userId: string
  username: string
  fullName: string
  message: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  userId: string
  username: string
  correlationId?: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  correlationId?: string
}

// -----------------------
// SQL & Query Types
// -----------------------

export interface SqlIntent {
  queryType: string
  entities: Record<string, string[]>
  filters: Record<string, string>[]
  confidence: number
}

export interface SqlGenerationRequest {
  question: string
  schemaName?: string | null
  forceRuleBased?: boolean
}

export type QueryGenerateRequest = SqlGenerationRequest

export interface SqlGenerationResponse {
  queryId?: string
  sql: string
  correlationId: string
  confidence: number
  intent: SqlIntent
  warnings?: string[]
  status?: string
}

export type QueryGenerateResponse = SqlGenerationResponse

export interface SqlValidationRequest {
  sql: string
  questionId?: string | null
}

export interface SqlValidationIssue {
  severity: 'info' | 'warning' | 'error'
  message: string
  line?: number | null
}

export interface SqlValidationResponse {
  isValid: boolean
  correlationId: string
  issues: SqlValidationIssue[]
  status?: string
}

export type QueryExecuteRequest = SqlExecutionRequest

export interface SqlExecutionRequest {
  question?: string
  sql: string
  parameters?: Record<string, unknown>
  limit?: number
}

export interface SqlExecutionResponse {
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  executionTimeMs: number
  correlationId: string
  cached?: boolean
  status?: string
}

export type QueryExecuteResponse = SqlExecutionResponse

export interface SqlFollowUpResponse {
  suggestions: string[]
  correlationId: string
}

export interface SqlSummaryRequest {
  queryId?: string
  sql?: string
}

export interface SqlSummaryResponse {
  summary: string
  correlationId: string
}

export interface QueryHistoryItem {
  queryId: string
  question: string
  sql: string
  status: string
  executionTimeMs?: number | null
  createdAt: string
}

export interface QueryHistoryResponse {
  items: QueryHistoryItem[]
  total: number
  correlationId?: string
}

export interface QueryHistory {
  items: QueryHistoryItem[]
  totalQueries: number
  successRate?: number
}

export interface Query extends QueryHistoryItem {
  userId?: string
  naturalLanguageQuery?: string
  generatedSQL?: string
  results?: QueryResultSet
  executionTime?: number
  rowCount?: number
  error?: string
  feedback?: FeedbackItem | null
  confidence?: number
  isFavorite?: boolean
  updatedAt?: string
}

export interface QueryResultSet {
  columns?: string[]
  rows?: Record<string, unknown>[]
}

export interface Analytics {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  averageExecutionTime: number
  topQueries: QueryHistoryItem[]
  recentQueries: QueryHistoryItem[]
}

// -----------------------
// Feedback & Training
// -----------------------

export interface FeedbackRequest {
  queryId: string
  rating: number
  comment?: string | null
  approvedForTraining?: boolean
}

export interface FeedbackResponse {
  feedbackId: string
  queryId: string
  status: string
  correlationId?: string
}

export interface FeedbackItem {
  id: string
  queryId: string
  rating: number | null
  comment: string | null
  approvedForTraining: boolean
  createdAt: string
}

export interface FeedbackListResponse {
  queryId: string
  feedbackItems: FeedbackItem[]
  totalCount: number
}

export interface QueryFeedback {
  rating: number
  comment?: string
  approvedForTraining?: boolean
}

export interface TrainingRequest {
  feedbackIds?: string[]
  description?: string | null
}

export interface TrainingResponse {
  trainingId: string
  status: string
  itemsCount: number
  message: string
  schemaVersion?: string | null
}

export interface FeedbackMetricsResponse {
  totalFeedbackCount: number
  approvedForTrainingCount: number
  averageRating: number
  queriesWithFeedback: number
}

// -----------------------
// Admin & Governance
// -----------------------

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalQueries: number
  systemHealth: 'healthy' | 'degraded' | 'critical'
  uptime: number
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical'
  database: 'ok' | 'error'
  cache: 'ok' | 'error'
  uptime: number
  timestamp: string
}

export interface SystemMetrics {
  averageQueryTime: number
  successRate: number
  activeQueries: number
  queriesPerMinute: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  requestsPerSecond?: number
  averageResponseTime?: number
  errorRate?: number
  requestVolumeSeries?: Array<{ timestamp: string; count: number }>
  latencyP95Series?: Array<{ timestamp: string; ms: number }>
  errorRateSeries?: Array<{ timestamp: string; rate: number }>
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  timestamp: string
  details?: Record<string, unknown>
  status: 'success' | 'failure'
}

export interface AdminFeatureResponse {
  message: string
  status: 'planned' | 'success'
}

export interface SystemConfigResponse {
  environment: string
  version: string
  features: Record<string, boolean>
}

export interface TrainingDataResponse {
  items: FeedbackItem[]
  total: number
  pendingCount?: number
}

// -----------------------
// Schema & Metadata
// -----------------------

export interface DatabaseColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey?: boolean
  foreignKey?: {
    table: string
    column: string
  }
}

export interface DatabaseTable {
  name: string
  columns: DatabaseColumn[]
  rowCount?: number
}

export interface DatabaseSchemaResponse {
  tables: DatabaseTable[]
}

// -----------------------
// Error Types
// -----------------------

export interface ApiError {
  message: string
  status?: number
  correlationId?: string
  retryAfter?: number
}

export interface ValidationError extends ApiError {
  errors?: Record<string, string[]>
}

// -----------------------
// Pagination Helpers
// -----------------------

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}
