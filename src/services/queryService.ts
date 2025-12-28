import { apiClient } from './apiClient'
import type {
  Query,
  QueryGenerateRequest,
  QueryGenerateResponse,
  QueryExecuteRequest,
  QueryExecuteResponse,
  QueryHistory,
  QueryHistoryResponse,
  Analytics,
  SqlValidationResponse,
  SqlFollowUpResponse,
  SqlSummaryRequest,
  SqlSummaryResponse,
  QueryHistoryItem,
} from '@/types'

interface RawQueryHistoryItem {
  id: string
  question: string
  generated_sql: string
  status: string
  execution_time_ms: number | null
  created_at: string
}

/**
 * Generate SQL from natural language question
 */
export const generateQuery = async (payload: QueryGenerateRequest): Promise<QueryGenerateResponse> => {
  const { data } = await apiClient.post<QueryGenerateResponse>('/sql/generate', payload)
  return data
}

/**
 * Execute a SQL query
 */
export const executeQuery = async (payload: QueryExecuteRequest): Promise<QueryExecuteResponse> => {
  const { data } = await apiClient.post<QueryExecuteResponse>('/sql/execute', payload)
  return data
}

/**
 * Validate SQL query syntax
 */
export const validateQuery = async (sql: string): Promise<SqlValidationResponse> => {
  const { data } = await apiClient.post<SqlValidationResponse>('/sql/validate', { sql })
  return data
}

/**
 * Get user's query history
 */
export const getQueryHistory = async (limit?: number): Promise<QueryHistoryResponse> => {
  const { data } = await apiClient.get<RawQueryHistoryItem[]>('/sql/history', {
    params: typeof limit === 'number' ? { limit } : undefined,
  })

  const items: QueryHistoryItem[] = data.map((item) => ({
    queryId: item.id,
    question: item.question,
    sql: item.generated_sql,
    status: item.status,
    executionTimeMs: item.execution_time_ms,
    createdAt: item.created_at,
  }))

  return {
    items,
    total: items.length,
  }
}

/**
 * Get a specific query by ID
 */
export const getQueryById = async (id: string): Promise<Query> => {
  const { data } = await apiClient.get<Query>(`/sql/history/${id}`)
  return data
}

/**
 * Get full query history object
 */
export const fetchQueryHistory = async (): Promise<QueryHistory> => {
  const { data } = await apiClient.get<QueryHistory>('/sql/history-summary')
  return data
}

/**
 * Get user analytics
 */
export const getAnalytics = async (): Promise<Analytics> => {
  const { data } = await apiClient.get<Analytics>('/analytics/user')
  return data
}

/**
 * Export query results
 */
export const exportQueryResults = async (
  queryId: string,
  format: 'csv' | 'json' | 'xlsx',
): Promise<Blob> => {
  const response = await apiClient.get(`/sql/${queryId}/export`, {
    params: { format },
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get suggested follow-up questions
 */
export const getFollowUpSuggestions = async (queryId: string): Promise<SqlFollowUpResponse> => {
  const { data } = await apiClient.get<SqlFollowUpResponse>(`/sql/${queryId}/followup`)
  return data
}

/**
 * Save query as favorite
 */
export const saveQueryAsFavorite = async (queryId: string): Promise<Query> => {
  const { data } = await apiClient.post<Query>(`/sql/${queryId}/favorite`)
  return data
}

/**
 * Remove query from favorites
 */
export const removeFavorite = async (queryId: string): Promise<Query> => {
  const { data } = await apiClient.delete<Query>(`/sql/${queryId}/favorite`)
  return data
}

/**
 * Delete a query
 */
export const deleteQuery = async (queryId: string): Promise<void> => {
  await apiClient.delete(`/sql/${queryId}`)
}

/**
 * Get query explanation
 */
export const getQueryExplanation = async (sql: string): Promise<{ explanation: string }> => {
  const { data } = await apiClient.post('/explain-sql', { sql })
  return data
}

/**
 * Summarize query results
 */
export const summarizeQuery = async (
  payload: SqlSummaryRequest,
): Promise<SqlSummaryResponse> => {
  const { data } = await apiClient.post<SqlSummaryResponse>('/sql/summarize', payload)
  return data
}
