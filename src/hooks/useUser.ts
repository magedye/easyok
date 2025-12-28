import { useMutation, useQuery as useReactQuery } from '@tanstack/react-query'
import * as userService from '@/services/userService'
import { useToast } from '@/components/shared/Toast'
import { useAuthStore } from '@/stores/authStore'
import type { RefreshTokenResponse } from '@/types'

const USER_CACHE_TIME = 1000 * 60 * 5 // 5 minutes
const USER_STALE_TIME = 1000 * 60 // 1 minute

/**
 * Hook to fetch current user profile
 */
export const useCurrentUser = () => {
  return useReactQuery({
    queryKey: ['currentUser'],
    queryFn: userService.getCurrentUser,
    staleTime: USER_STALE_TIME,
    gcTime: USER_CACHE_TIME,
  })
}

/**
 * Hook to update user profile
 */
export const useUpdateProfile = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: userService.updateUserProfile,
    onSuccess: () => {
      toast.showToast({
        title: 'Profile updated successfully',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to update profile',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to change password
 */
export const useChangePassword = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      userService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.showToast({
        title: 'Password changed successfully',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to change password',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to fetch user preferences
 */
export const useUserPreferences = () => {
  return useReactQuery({
    queryKey: ['userPreferences'],
    queryFn: userService.getUserPreferences,
    staleTime: USER_CACHE_TIME,
    gcTime: USER_CACHE_TIME,
  })
}

/**
 * Hook to update user preferences
 */
export const useUpdatePreferences = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: userService.updateUserPreferences,
    onSuccess: () => {
      toast.showToast({
        title: 'Preferences updated',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to update preferences',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to logout user
 */
export const useLogout = () => {
  const { logout: storeLogout } = useAuthStore()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: userService.logout,
    onSuccess: () => {
      storeLogout()
      toast.showToast({
        title: 'Logged out successfully',
        variant: 'success',
      })
    },
    onError: () => {
      storeLogout() // Still clear local state even if API call fails
      toast.showToast({
        title: 'Logged out',
        variant: 'info',
      })
    },
  })

  return mutation
}

/**
 * Hook to request password reset
 */
export const useRequestPasswordReset = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: userService.requestPasswordReset,
    onSuccess: () => {
      toast.showToast({
        title: 'Password reset email sent',
        variant: 'success',
        description: 'Check your email for reset instructions',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to send reset email',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to reset password with token
 */
export const useResetPassword = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      userService.resetPassword(token, newPassword),
    onSuccess: () => {
      toast.showToast({
        title: 'Password reset successfully',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to reset password',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to refresh access token
 */
export const useRefreshToken = () => {
  const { login } = useAuthStore()

  const mutation = useMutation({
    mutationFn: userService.refreshToken,
    onSuccess: (data: RefreshTokenResponse) => {
      const state = useAuthStore.getState()
      if (state.user) {
        login({
          accessToken: data.accessToken,
          tokenType: data.tokenType ?? 'bearer',
          userId: state.user.userId,
          username: state.user.username,
        })
      }
    },
  })

  return mutation
}
