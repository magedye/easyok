import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import { resetPassword } from '@/services/userService'
import { handleApiError } from '@/utils/errorHandler'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type ResetPasswordForm = z.infer<typeof schema>

export const ResetPasswordPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(schema),
  })

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 px-4 py-12">
        <Card className="w-full max-w-md shadow-2xl text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/forgot-password')}>
            Request New Link
          </Button>
        </Card>
      </div>
    )
  }

  const onSubmit = async (values: ResetPasswordForm) => {
    setError(null)
    setIsLoading(true)

    try {
      await resetPassword(token, values.password)
      navigate('/login', { state: { message: 'Password reset successful. Please log in.' } })
    } catch (err) {
      const apiError = handleApiError(err)
      setError(apiError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-500 via-teal-500 to-blue-500 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-white/90">Enter your new password</p>
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
            <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="New Password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
            disabled={isLoading}
          />
          <Input
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
            disabled={isLoading}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
