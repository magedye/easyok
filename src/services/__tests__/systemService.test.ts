import { describe, expect, it, afterEach, vi } from 'vitest'
import { systemClient } from '../apiClient'
import { fetchRoot, fetchHealth, fetchMetrics, fetchMetricsJson } from '../systemService'

describe('systemService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads root discovery', async () => {
    const mockResponse = { message: 'ok', docs: '/docs', openapi: '/openapi.json', health: '/health', metrics: '/metrics' }
    vi.spyOn(systemClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await fetchRoot()

    expect(systemClient.get).toHaveBeenCalledWith('/')
    expect(result).toEqual(mockResponse)
  })

  it('reads health', async () => {
    const mockResponse = { status: 'healthy', version: '1.0.0', providersActive: 1, dependencies: { postgres: true, redis: true, chroma: true }, features: { circuitBreaker: true, correlationIds: true, failover: true } }
    vi.spyOn(systemClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await fetchHealth()

    expect(systemClient.get).toHaveBeenCalledWith('/health')
    expect(result).toEqual(mockResponse)
  })

  it('reads metrics text', async () => {
    vi.spyOn(systemClient, 'get').mockResolvedValueOnce({ data: '# HELP api_requests_total', config: {} } as never)

    const result = await fetchMetrics()

    expect(systemClient.get).toHaveBeenCalledWith('/metrics', { responseType: 'text' })
    expect(result).toEqual('# HELP api_requests_total')
  })

  it('reads metrics json', async () => {
    const mockResponse = { appInfo: { name: 'app', version: '1.0.0' }, providersTotal: 1, serviceStatus: 'healthy', dependencies: { postgres: true, redis: true, chroma: true }, features: { circuitBreaker: true, correlationIds: true, failover: true } }
    vi.spyOn(systemClient, 'get').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await fetchMetricsJson()

    expect(systemClient.get).toHaveBeenCalledWith('/metrics/json')
    expect(result).toEqual(mockResponse)
  })
})
