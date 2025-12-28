import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { apiClient } from '../apiClient'
import {
  loginRequest,
  signupRequest,
  refreshAccessToken,
  getCurrentUserProfile,
} from '../authService'

describe('authService', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'post').mockClear()
    vi.spyOn(apiClient, 'get').mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs in via /auth/login', async () => {
    const mockResponse = {
      access_token: 'token',
      token_type: 'bearer',
      user_id: '1',
      username: 'test-user',
    }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await loginRequest({ username: 'test-user', password: 'secret' })

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'test-user',
      password: 'secret',
    })
    expect(result).toEqual({
      accessToken: 'token',
      tokenType: 'bearer',
      userId: '1',
      username: 'test-user',
      correlationId: undefined,
    })
  })

  it('signs up via /auth/signup', async () => {
    const mockResponse = {
      user_id: 'u-1',
      username: 'new@example.com',
      full_name: 'New User',
      message: 'User created successfully',
    }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await signupRequest({
      username: 'new@example.com',
      password: 'secret',
      fullName: 'New User',
      recoveryEmail: 'new@example.com',
    })

    expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', {
      username: 'new@example.com',
      password: 'secret',
      full_name: 'New User',
      recovery_email: 'new@example.com',
    })
    expect(result).toEqual({
      userId: 'u-1',
      username: 'new@example.com',
      fullName: 'New User',
      message: 'User created successfully',
    })
  })

  it('refreshes token via /refresh-token', async () => {
    const mockResponse = { accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 86400 }
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse } as never)

    const result = await refreshAccessToken({ refreshToken: 'refresh-me' })

    expect(apiClient.post).toHaveBeenCalledWith('/refresh-token', { refreshToken: 'refresh-me' })
    expect(result).toEqual(mockResponse)
  })

  it('fetches current user via /auth/me', async () => {
    const mockUser = { userId: '1', username: 'test-user', fullName: 'Test User', role: 'admin' }
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockUser } as never)

    const result = await getCurrentUserProfile()

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual(mockUser)
  })
})
