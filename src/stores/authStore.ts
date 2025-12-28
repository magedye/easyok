import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthResponse, UserRole } from '@/types'

interface AuthUser {
  userId: string
  username: string
  role?: UserRole
  fullName?: string
  recoveryEmail?: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (payload: AuthResponse) => void
  logout: () => void
  setLoading: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      login: (payload) =>
        set((state) => ({
          user: {
            ...(state.user ?? {}),
            userId: payload.userId,
            username: payload.username,
          },
          token: payload.accessToken,
          isLoading: false,
        })),
      logout: () =>
        set({
          user: null,
          token: null,
          isLoading: false,
        }),
      setLoading: (state) => set({ isLoading: state }),
    }),
    {
      name: 'vanna-auth-store',
      version: 1,
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
