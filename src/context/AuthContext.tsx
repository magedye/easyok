import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRequest, logoutRequest, getCurrentUserProfile, refreshAccessToken } from '@/services/authService'
import type { User, LoginRequest, AuthResponse } from '@/types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'vanna_access_token'
const REFRESH_TOKEN_KEY = 'vanna_refresh_token'
const USER_KEY = 'vanna_user'

const normalizeUser = (rawUser: Partial<User> & { id?: string; name?: string; email?: string }): User => {
  const userId = rawUser.userId ?? rawUser.id ?? 'unknown'
  const username =
    rawUser.username ?? rawUser.fullName ?? rawUser.name ?? rawUser.recoveryEmail ?? rawUser.email ?? userId

  return {
    userId,
    username,
    role: rawUser.role,
    fullName: rawUser.fullName ?? rawUser.name,
    recoveryEmail: rawUser.recoveryEmail ?? rawUser.email ?? null,
    status: rawUser.status,
    isActive: rawUser.isActive,
    createdAt: rawUser.createdAt,
    updatedAt: rawUser.updatedAt,
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const saveTokens = useCallback((accessToken: string, refreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  }, [])

  const clearTokens = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }, [])

  const loadUserFromStorage = useCallback(() => {
    const storedUser = localStorage.getItem(USER_KEY)
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(normalizeUser(parsed))
      } catch (error) {
        console.error('Failed to parse stored user:', error)
        clearTokens()
      }
    }
  }, [clearTokens])

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const currentUser = await getCurrentUserProfile()
      const normalized = normalizeUser(currentUser)
      setUser(normalized)
      localStorage.setItem(USER_KEY, JSON.stringify(normalized))
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      clearTokens()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [clearTokens])

  useEffect(() => {
    loadUserFromStorage()
    fetchCurrentUser()
  }, [loadUserFromStorage, fetchCurrentUser])

  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true)
    try {
      const response: AuthResponse = await loginRequest(credentials)
      saveTokens(response.accessToken)
      const nextUser: User = normalizeUser({
        userId: response.userId,
        username: response.username,
      })
      setUser(nextUser)
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      navigate('/dashboard')
    } catch (error: any) {
      clearTokens()
      setUser(null)
      throw new Error(error?.response?.data?.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }, [navigate, saveTokens, clearTokens])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await logoutRequest()
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      clearTokens()
      setUser(null)
      setIsLoading(false)
      navigate('/login')
    }
  }, [navigate, clearTokens])

  const refreshToken = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!storedRefreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await refreshAccessToken({ refreshToken: storedRefreshToken })
      saveTokens(response.accessToken)
    } catch (error) {
      clearTokens()
      setUser(null)
      navigate('/login')
      throw error
    }
  }, [saveTokens, clearTokens, navigate])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}
