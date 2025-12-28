import { apiClient } from './apiClient'
import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  SignupResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  User,
} from '@/types'

interface LoginResponseDto {
  access_token: string
  token_type: string
  user_id: string
  username: string
  correlation_id?: string
}

interface SignupResponseDto {
  user_id: string
  username: string
  full_name: string
  message: string
}

export const loginRequest = async (payload: LoginRequest): Promise<AuthResponse> => {
  const { data } = await apiClient.post<LoginResponseDto>('/auth/login', {
    username: payload.username,
    password: payload.password,
  })
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    userId: data.user_id,
    username: data.username,
    correlationId: data.correlation_id,
  }
}

export const signupRequest = async (payload: SignupRequest): Promise<SignupResponse> => {
  const { data } = await apiClient.post<SignupResponseDto>('/auth/signup', {
    username: payload.username,
    password: payload.password,
    full_name: payload.fullName,
    recovery_email: payload.recoveryEmail ?? null,
  })
  return {
    userId: data.user_id,
    username: data.username,
    fullName: data.full_name,
    message: data.message,
  }
}

export const refreshAccessToken = async (
  payload: RefreshTokenRequest,
): Promise<RefreshTokenResponse> => {
  const { data } = await apiClient.post<RefreshTokenResponse>('/refresh-token', payload)
  return data
}

export const logoutRequest = async (): Promise<void> => {
  await apiClient.post('/logout')
}

export const getCurrentUserProfile = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}
