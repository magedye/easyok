import axios from 'axios'

export interface ApiError {
  message: string
  status?: number
  correlationId?: string
  retryAfter?: number
}

export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const backendMessage =
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.response?.data?.detail ??
      error.message
    const correlationId = error.response?.data?.correlation_id
    const retryAfterHeader = error.response?.headers?.['retry-after']
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined

    return {
      message: getUserFriendlyMessage(status, backendMessage),
      status,
      correlationId,
      retryAfter: Number.isNaN(retryAfter) ? undefined : retryAfter,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
    }
  }

  return {
    message: 'An unknown error occurred',
  }
}

const getUserFriendlyMessage = (status?: number, defaultMessage?: string): string => {
  switch (status) {
    case 400:
      return defaultMessage || 'Invalid request. Please check your input.'
    case 401:
      return 'Your session has expired. Please log in again.'
    case 403:
      return "You don't have permission to perform this action."
    case 404:
      return 'The requested resource was not found.'
    case 409:
      return defaultMessage || 'This resource already exists.'
    case 422:
      return defaultMessage || 'Validation failed. Please check your input.'
    case 429:
      return 'Too many requests. Please try again later.'
    case 500:
      return 'Server error. Please try again later.'
    case 503:
      return 'Service temporarily unavailable. Please try again later.'
    default:
      return defaultMessage || 'An error occurred. Please try again.'
  }
}

export const showErrorNotification = (error: ApiError) => {
  console.error('API Error:', error)
}
