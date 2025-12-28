import { apiClient } from './apiClient'
import type { User, RefreshTokenResponse } from '@/types'

/**
 * Get current user profile
 */
export const getCurrentUser = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

/**
 * Update user profile
 */
export const updateUserProfile = async (
  updates: Partial<Omit<User, 'id' | 'role'>>,
): Promise<User> => {
  const { data } = await apiClient.patch<User>('/users/me', updates)
  return data
}

/**
 * Change password
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> => {
  const { data } = await apiClient.post('/users/me/change-password', {
    currentPassword,
    newPassword,
  })
  return data
}

/**
 * Get user preferences
 */
export const getUserPreferences = async (): Promise<{
  theme: 'light' | 'dark' | 'system'
  locale: 'en' | 'ar'
  notifications: {
    email: boolean
    queryResults: boolean
    systemUpdates: boolean
  }
}> => {
  const { data } = await apiClient.get('/users/me/preferences')
  return data
}

/**
 * Update user preferences
 */
export const updateUserPreferences = async (
  preferences: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const { data } = await apiClient.patch('/users/me/preferences', preferences)
  return data
}

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  await apiClient.post('/logout')
}

/**
 * Request password reset
 */
export const requestPasswordReset = async (email: string): Promise<{ success: boolean }> => {
  const { data } = await apiClient.post('/auth/forgot-password', { email })
  return data
}

/**
 * Reset password with token
 */
export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> => {
  const { data } = await apiClient.post('/auth/reset-password', { token, newPassword })
  return data
}

/**
 * Refresh access token
 */
export const refreshToken = async (refreshToken: string): Promise<RefreshTokenResponse> => {
  const { data } = await apiClient.post('/refresh-token', { refreshToken })
  return data
}
