import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { loginRequest } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import type { AuthResponse } from '@/types'

export const useAuth = () => {
  const { user, token, login, logout, isLoading, setLoading } = useAuthStore()

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data: AuthResponse) => {
      login(data)
    },
    onSettled: () => setLoading(false),
  })

  const handleLogin = useCallback(
    async (identifier: string, password: string) => {
      setLoading(true)
      await mutation.mutateAsync({ username: identifier, password })
    },
    [mutation, setLoading],
  )

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return {
    user,
    token,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    mutation,
  }
}
