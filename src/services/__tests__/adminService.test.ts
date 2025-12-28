import { describe, expect, it, afterEach, vi } from 'vitest'
import { apiClient } from '../apiClient'
import {
  approveSql,
  getFeedbackMetrics,
  getTrainingData,
  approveTrainingData,
  reloadSchema,
  createScheduledReport,
  deleteScheduledReport,
} from '../adminService'

describe('adminService planned endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('approves SQL via /admin/approve-sql', async () => {
    const mockResponse = { message: 'Planned', status: 'planned' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await approveSql()

    expect(apiClient.post).toHaveBeenCalledWith('/admin/approve-sql')
    expect(result).toEqual(mockResponse)
  })

  it('fetches feedback metrics', async () => {
    const mockResponse = {
      total_feedback_count: 10,
      approved_for_training_count: 4,
      average_rating: 4.5,
      queries_with_feedback: 8,
    }
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await getFeedbackMetrics()

    expect(apiClient.get).toHaveBeenCalledWith('/admin/feedback-metrics')
    expect(result).toEqual({
      totalFeedbackCount: 10,
      approvedForTrainingCount: 4,
      averageRating: 4.5,
      queriesWithFeedback: 8,
    })
  })

  it('fetches training data', async () => {
    const mockResponse = { items: [], total: 0 }
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await getTrainingData()

    expect(apiClient.get).toHaveBeenCalledWith('/admin/training-data')
    expect(result).toEqual(mockResponse)
  })

  it('approves training data', async () => {
    const mockResponse = { trainingId: 'tr-1', status: 'approved', itemsCount: 1, message: 'ok' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await approveTrainingData([])

    expect(apiClient.post).toHaveBeenCalledWith('/admin/training-data/approve', {
      feedback: [],
    })
    expect(result).toEqual(mockResponse)
  })

  it('reloads schema via /admin/schema/reload', async () => {
    const mockResponse = { status: 'reloaded' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await reloadSchema()

    expect(apiClient.post).toHaveBeenCalledWith('/admin/schema/reload')
    expect(result).toEqual(mockResponse)
  })

  it('creates scheduled report', async () => {
    const mockResponse = { message: 'Planned', status: 'planned' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await createScheduledReport({ cron: '* * * * *' })

    expect(apiClient.post).toHaveBeenCalledWith('/admin/scheduled/create', { cron: '* * * * *' })
    expect(result).toEqual(mockResponse)
  })

  it('deletes scheduled report', async () => {
    const mockResponse = { message: 'Planned', status: 'planned' }
    vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await deleteScheduledReport('rep-1')

    expect(apiClient.delete).toHaveBeenCalledWith('/admin/scheduled/rep-1')
    expect(result).toEqual(mockResponse)
  })
})
