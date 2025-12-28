import { describe, expect, it, afterEach, vi } from 'vitest'
import { apiClient } from '../apiClient'
import { generateQuery, validateQuery, getQueryHistory, summarizeQuery } from '../queryService'

describe('queryService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls /sql/generate', async () => {
    const mockResponse = {
      sql: 'SELECT 1',
      correlationId: 'corr',
      confidence: 0.9,
      intent: { queryType: 'COUNT', entities: {}, filters: [], confidence: 0.9 },
    }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const payload = { question: 'How many orders?' }
    const result = await generateQuery(payload)

    expect(apiClient.post).toHaveBeenCalledWith('/sql/generate', payload)
    expect(result).toEqual(mockResponse)
  })

  it('validates SQL via /sql/validate', async () => {
    const mockResponse = { isValid: true, correlationId: 'corr', issues: [] }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await validateQuery('SELECT 1')

    expect(apiClient.post).toHaveBeenCalledWith('/sql/validate', { sql: 'SELECT 1' })
    expect(result).toEqual(mockResponse)
  })

  it('fetches history from /sql/history and normalizes response', async () => {
    const mockResponse = [
      {
        id: 'h-1',
        question: 'Q1',
        generated_sql: 'SELECT 1',
        status: 'completed',
        execution_time_ms: 10,
        created_at: '2024-01-01T00:00:00Z',
      },
    ]
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await getQueryHistory(5)

    expect(apiClient.get).toHaveBeenCalledWith('/sql/history', { params: { limit: 5 } })
    expect(result).toEqual({
      items: [
        {
          queryId: 'h-1',
          question: 'Q1',
          sql: 'SELECT 1',
          status: 'completed',
          executionTimeMs: 10,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      total: 1,
    })
  })

  it('summarizes queries via /sql/summarize', async () => {
    const mockResponse = { summary: 'Summary', correlationId: 'corr' }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await summarizeQuery({ queryId: 'q-1' })

    expect(apiClient.post).toHaveBeenCalledWith('/sql/summarize', { queryId: 'q-1' })
    expect(result).toEqual(mockResponse)
  })
})
