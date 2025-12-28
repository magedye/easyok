import { apiClient } from './apiClient'
import type {
  FeedbackRequest,
  FeedbackResponse,
  FeedbackListResponse,
  TrainingRequest,
  TrainingResponse,
} from '@/types'

/**
 * Submit feedback for a generated query
 */
export const submitFeedback = async (payload: FeedbackRequest): Promise<FeedbackResponse> => {
  const { data } = await apiClient.post<FeedbackResponse>('/feedback', payload)
  return data
}

/**
 * Get feedback items for a specific query
 */
export const getFeedbackForQuery = async (queryId: string): Promise<FeedbackListResponse> => {
  const { data } = await apiClient.get<FeedbackListResponse>(`/feedback/${queryId}`)
  return data
}

/**
 * Request training job for approved feedback
 */
export const requestTrainingJob = async (
  payload: TrainingRequest,
): Promise<TrainingResponse> => {
  const { data } = await apiClient.post<TrainingResponse>('/feedback/train', payload)
  return data
}
