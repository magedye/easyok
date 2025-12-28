import axios, { type AxiosRequestConfig } from 'axios'
import { generateCorrelationId } from '@/utils/correlation'
import { getAccessToken } from '@/context/AuthContext'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
const backendBaseUrl =
  import.meta.env.VITE_BACKEND_BASE_URL ??
  apiBaseUrl.replace(/\/api\/v\d+$/i, '')

const withAuthHeaders = (config: AxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    }
  }
  return config
}

const withCorrelation = (config: AxiosRequestConfig) => {
  config.headers = {
    ...(config.headers || {}),
    'X-Correlation-ID': generateCorrelationId(),
    'Accept-Language': document.documentElement.lang || 'ar',
  }
  return config
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: Number(import.meta.env.VITE_REQUEST_TIMEOUT) || 20000,
  withCredentials: true,
})

export const systemClient = axios.create({
  baseURL: backendBaseUrl,
  timeout: Number(import.meta.env.VITE_REQUEST_TIMEOUT) || 20000,
})

const attachInterceptors = (client: typeof apiClient, includeAuth: boolean) => {
  // Use `any` here to avoid strict mismatches between Axios internal request types
  // and our wrapper helpers; we ensure at runtime the config object is valid.
  client.interceptors.request.use((config: any) => {
    const enhancedConfig = includeAuth ? withAuthHeaders(config) : config
    return withCorrelation(enhancedConfig) as any
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const correlationId = error.response?.data?.correlation_id
      if (correlationId) {
        console.error('Request failed', { correlationId })
      }
      return Promise.reject(error)
    },
  )
}

attachInterceptors(apiClient, true)
attachInterceptors(systemClient, false)
