import { apiClient } from './apiClient'
import type {
  AdminStats,
  AdminFeatureResponse,
  AuditLog,
  FeedbackItem,
  TrainingDataResponse,
  TrainingResponse,
  User,
  PaginationParams,
  PaginatedResponse,
  SystemHealth,
  SystemMetrics,
  DatabaseSchemaResponse,
  FeedbackMetricsResponse,
} from '@/types'

/**
 * Get admin dashboard statistics
 */
export const getAdminStats = async (): Promise<AdminStats> => {
  const { data } = await apiClient.get<AdminStats>('/admin/stats')
  return data
}

/**
 * Get audit logs
 */
export const getAuditLogs = async (params?: PaginationParams): Promise<PaginatedResponse<AuditLog>> => {
  const { data } = await apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', {
    params,
  })
  return data
}

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (params?: PaginationParams): Promise<PaginatedResponse<User>> => {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/admin/users', {
    params,
  })
  return data
}

/**
 * Get user details
 */
export const getUserById = async (userId: string): Promise<User> => {
  const { data } = await apiClient.get<User>(`/admin/users/${userId}`)
  return data
}

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (
  userId: string,
  role: 'analyst' | 'admin' | 'viewer',
): Promise<User> => {
  const { data } = await apiClient.patch<User>(`/admin/users/${userId}`, { role })
  return data
}

/**
 * Disable user account (admin only)
 */
export const disableUser = async (userId: string): Promise<User> => {
  const { data } = await apiClient.post<User>(`/admin/users/${userId}/disable`)
  return data
}

/**
 * Enable user account (admin only)
 */
export const enableUser = async (userId: string): Promise<User> => {
  const { data } = await apiClient.post<User>(`/admin/users/${userId}/enable`)
  return data
}

/**
 * Get database schema
 */
export const getDatabaseSchema = async (): Promise<DatabaseSchemaResponse> => {
  const { data } = await apiClient.get<DatabaseSchemaResponse>('/admin/schema')
  return data
}

/**
 * Refresh schema cache
 */
export const refreshSchemaCache = async (): Promise<{ success: boolean; timestamp: string }> => {
  const { data } = await apiClient.post('/admin/schema/refresh')
  return data
}

/**
 * Get system health status
 */
export const getSystemHealth = async (): Promise<SystemHealth> => {
  const { data } = await apiClient.get<SystemHealth>('/admin/health')
  return data
}

/**
 * Get system metrics
 */
export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  const { data } = await apiClient.get<SystemMetrics>('/admin/metrics')
  return data
}

/**
 * Export audit logs
 */
export const exportAuditLogs = async (
  format: 'csv' | 'json',
  filters?: Record<string, unknown>,
): Promise<Blob> => {
  const response = await apiClient.post('/admin/audit-logs/export', { format, filters }, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get system configuration
 */
export const getSystemConfig = async (): Promise<Record<string, unknown>> => {
  const { data } = await apiClient.get('/admin/config')
  return data
}

/**
 * Update system configuration (admin only)
 */
export const updateSystemConfig = async (config: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { data } = await apiClient.post('/admin/config', config)
  return data
}

/**
 * Approve SQL (planned feature)
 */
export const approveSql = async (): Promise<AdminFeatureResponse> => {
  const { data } = await apiClient.post<AdminFeatureResponse>('/admin/approve-sql')
  return data
}

interface FeedbackMetricsDto {
  total_feedback_count: number
  approved_for_training_count: number
  average_rating: number
  queries_with_feedback: number
}

/**
 * Fetch feedback metrics
 */
export const getFeedbackMetrics = async (): Promise<FeedbackMetricsResponse> => {
  const { data } = await apiClient.get<FeedbackMetricsDto>('/admin/feedback-metrics')
  return {
    totalFeedbackCount: data.total_feedback_count,
    approvedForTrainingCount: data.approved_for_training_count,
    averageRating: data.average_rating,
    queriesWithFeedback: data.queries_with_feedback,
  }
}

/**
 * Fetch pending training data for governance review
 */
export const getTrainingData = async (): Promise<TrainingDataResponse> => {
  const { data } = await apiClient.get<TrainingDataResponse>('/admin/training-data')
  return data
}

/**
 * Approve or reject training data
 */
export const approveTrainingData = async (
  feedbackItems: FeedbackItem[],
): Promise<TrainingResponse> => {
  const { data } = await apiClient.post<TrainingResponse>('/admin/training-data/approve', {
    feedback: feedbackItems,
  })
  return data
}

/**
 * Reload schema cache (dbt integration)
 */
export const reloadSchema = async (): Promise<{ status: string }> => {
  const { data } = await apiClient.post<{ status: string }>('/admin/schema/reload')
  return data
}

/**
 * Create scheduled report (planned)
 */
export const createScheduledReport = async (
  payload: Record<string, unknown>,
): Promise<AdminFeatureResponse> => {
  const { data } = await apiClient.post<AdminFeatureResponse>('/admin/scheduled/create', payload)
  return data
}

/**
 * List scheduled reports (planned)
 */
export const listScheduledReports = async (): Promise<AdminFeatureResponse> => {
  const { data } = await apiClient.get<AdminFeatureResponse>('/admin/scheduled/list')
  return data
}

/**
 * Delete scheduled report (planned)
 */
export const deleteScheduledReport = async (reportId: string): Promise<AdminFeatureResponse> => {
  const { data } = await apiClient.delete<AdminFeatureResponse>(`/admin/scheduled/${reportId}`)
  return data
}
