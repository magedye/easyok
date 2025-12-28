import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import { requestPasswordReset } from '@/services/userService'
import { handleApiError } from '@/utils/errorHandler'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordForm = z.infer<typeof schema>

export const ForgotPasswordPage = () => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: ForgotPasswordForm) => {
    setError(null)
    setIsLoading(true)

    try {
      await requestPasswordReset(values.email)
      setSuccess(true)
    } catch (err) {
      const apiError = handleApiError(err)
      setError(apiError.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 px-4 py-12">
        <Card className="w-full max-w-md shadow-2xl text-center">
          <div className="mb-4 text-6xl">📧</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Check Your Email
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            We've sent password reset instructions to your email address.
          </p>
          <Link to="/login">
            <Button variant="primary" className="w-full">
              Back to Login
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Forgot Password?</h1>
        <p className="text-white/90">Enter your email to reset your password</p>
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
            <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
            disabled={isLoading}
            placeholder="Enter your email address"
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  )
}
