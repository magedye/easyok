import { systemClient } from './apiClient'
import type { RootDiscoveryResponse, HealthResponse, MetricsSnapshot } from '@/types'

export const fetchRoot = async (): Promise<RootDiscoveryResponse> => {
  const { data } = await systemClient.get<RootDiscoveryResponse>('/')
  return data
}

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { data } = await systemClient.get<HealthResponse>('/health')
  return data
}

export const fetchMetrics = async (): Promise<string> => {
  const { data } = await systemClient.get<string>('/metrics', {
    responseType: 'text',
  })
  return data
}

export const fetchMetricsJson = async (): Promise<MetricsSnapshot> => {
  const { data } = await systemClient.get<MetricsSnapshot>('/metrics/json')
  return data
}
