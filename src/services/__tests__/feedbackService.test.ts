import { describe, expect, it, afterEach, vi } from 'vitest'
import { apiClient } from '../apiClient'
import {
  submitFeedback,
  getFeedbackForQuery,
  requestTrainingJob,
} from '../feedbackService'

describe('feedbackService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits feedback to /feedback', async () => {
    const mockResponse = { feedbackId: 'fb-1', queryId: 'q-1', status: 'recorded' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await submitFeedback({
      queryId: 'q-1',
      rating: 5,
      comment: 'Great',
    })

    expect(apiClient.post).toHaveBeenCalledWith('/feedback', {
      queryId: 'q-1',
      rating: 5,
      comment: 'Great',
    })
    expect(result).toEqual(mockResponse)
  })

  it('fetches feedback for a query', async () => {
    const mockResponse = { queryId: 'q-1', feedbackItems: [], totalCount: 0 }
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await getFeedbackForQuery('q-1')

    expect(apiClient.get).toHaveBeenCalledWith('/feedback/q-1')
    expect(result).toEqual(mockResponse)
  })

  it('requests training job', async () => {
    const mockResponse = { trainingId: 'tr-1', status: 'queued', itemsCount: 1, message: 'ok' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await requestTrainingJob({ feedbackIds: ['fb-1'] })

    expect(apiClient.post).toHaveBeenCalledWith('/feedback/train', { feedbackIds: ['fb-1'] })
    expect(result).toEqual(mockResponse)
  })
})
