import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Card } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { useAuth } from '@/context/AuthContext'
import { 
  getCurrentUser, 
  updateUserProfile, 
  changePassword, 
  getUserPreferences, 
  updateUserPreferences 
} from '@/services/userService'
import { handleApiError } from '@/utils/errorHandler'

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  recoveryEmail: z.string().email('Invalid email address'),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export const SettingsPage = () => {
  const { t, i18n } = useTranslation()
  const { user: authUser, updateUser } = useAuth()
  const isRtl = i18n.dir() === 'rtl'
  const queryClient = useQueryClient()
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    enabled: !!authUser,
  })

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: getUserPreferences,
    enabled: !!authUser,
  })

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      recoveryEmail: '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName ?? user.username,
        recoveryEmail: user.recoveryEmail ?? '',
      })
    }
  }, [user, profileForm])

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => updateUserProfile(data),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      updateUser(updatedUser)
      setSuccess('Profile updated successfully')
      setError(null)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err) => {
      const apiError = handleApiError(err)
      setError(apiError.message)
      setSuccess(null)
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) => 
      changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      passwordForm.reset()
      setSuccess('Password changed successfully')
      setError(null)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err) => {
      const apiError = handleApiError(err)
      setError(apiError.message)
      setSuccess(null)
    },
  })

  const preferencesMutation = useMutation({
    mutationFn: (prefs: any) => updateUserPreferences(prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
      setSuccess('Preferences updated successfully')
      setError(null)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err) => {
      const apiError = handleApiError(err)
      setError(apiError.message)
      setSuccess(null)
    },
  })

  const handleSaveApiUrl = () => {
    localStorage.setItem('VITE_API_BASE_URL', apiUrl)
    setSuccess('API URL saved. Please refresh the page.')
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleTestConnection = async () => {
    try {
      const response = await fetch(`${apiUrl.replace(/\/api\/v\d+$/i, '')}/health`)
      if (response.ok) {
        setSuccess('Connection successful!')
        setError(null)
      } else {
        setError('Connection failed. Please check the URL.')
        setSuccess(null)
      }
    } catch (err) {
      setError('Connection failed. Please check the URL.')
      setSuccess(null)
    }
    setTimeout(() => {
      setSuccess(null)
      setError(null)
    }, 3000)
  }

  const onProfileSubmit = (data: ProfileForm) => {
    profileMutation.mutate({
      fullName: data.fullName,
      recoveryEmail: data.recoveryEmail,
    })
  }

  const onPasswordSubmit = (data: PasswordForm) => {
    passwordMutation.mutate(data)
  }

  return (
    <div className={clsx('space-y-6', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          {t('common.settings') || 'Settings'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Manage your account settings and preferences
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
          <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-md">
          <p className="text-sm text-green-900 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Profile Settings */}
      <Card title="Profile Information" description="Update your personal information">
        {userLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
            <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
          </div>
        ) : (
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              {...profileForm.register('fullName')}
              error={profileForm.formState.errors.fullName?.message}
              disabled={profileMutation.isPending}
            />
            <Input
              label="Email"
              type="email"
              {...profileForm.register('recoveryEmail')}
              error={profileForm.formState.errors.recoveryEmail?.message}
              disabled={profileMutation.isPending}
            />
            <Button 
              type="submit" 
              variant="primary"
              disabled={profileMutation.isPending || !profileForm.formState.isDirty}
            >
              {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        )}
      </Card>

      {/* Password Change */}
      <Card title="Change Password" description="Update your account password">
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            {...passwordForm.register('currentPassword')}
            error={passwordForm.formState.errors.currentPassword?.message}
            disabled={passwordMutation.isPending}
          />
          <Input
            label="New Password"
            type="password"
            {...passwordForm.register('newPassword')}
            error={passwordForm.formState.errors.newPassword?.message}
            disabled={passwordMutation.isPending}
          />
          <Input
            label="Confirm New Password"
            type="password"
            {...passwordForm.register('confirmPassword')}
            error={passwordForm.formState.errors.confirmPassword?.message}
            disabled={passwordMutation.isPending}
          />
          <Button 
            type="submit" 
            variant="primary"
            disabled={passwordMutation.isPending}
          >
            {passwordMutation.isPending ? 'Changing Password...' : 'Change Password'}
          </Button>
        </form>
      </Card>

      {/* User Preferences */}
      <Card title="Preferences" description="Customize your experience">
        {preferencesLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
            <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Theme
              </label>
              <select
                value={preferences?.theme || 'light'}
                onChange={(e) => preferencesMutation.mutate({ theme: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
                disabled={preferencesMutation.isPending}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Language
              </label>
              <select
                value={preferences?.locale || 'en'}
                onChange={(e) => preferencesMutation.mutate({ locale: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
                disabled={preferencesMutation.isPending}
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                Notifications
              </h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences?.notifications?.email || false}
                    onChange={(e) => preferencesMutation.mutate({
                      notifications: { ...preferences?.notifications, email: e.target.checked }
                    })}
                    className="mr-2"
                    disabled={preferencesMutation.isPending}
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Email notifications
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences?.notifications?.queryResults || false}
                    onChange={(e) => preferencesMutation.mutate({
                      notifications: { ...preferences?.notifications, queryResults: e.target.checked }
                    })}
                    className="mr-2"
                    disabled={preferencesMutation.isPending}
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Query completion notifications
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences?.notifications?.systemUpdates || false}
                    onChange={(e) => preferencesMutation.mutate({
                      notifications: { ...preferences?.notifications, systemUpdates: e.target.checked }
                    })}
                    className="mr-2"
                    disabled={preferencesMutation.isPending}
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    System update notifications
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* API Configuration */}
      <Card title="API Configuration" description="Configure backend API connection">
        <div className="space-y-4">
          <Input
            label="API Base URL"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8000/api/v1"
          />
          <div className="flex gap-3">
            <Button onClick={handleSaveApiUrl} variant="primary">
              Save URL
            </Button>
            <Button onClick={handleTestConnection} variant="secondary">
              Test Connection
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
