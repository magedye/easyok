import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import { signupRequest } from '@/services/authService'
import { handleApiError } from '@/utils/errorHandler'

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type SignupForm = z.infer<typeof schema>

export const SignupPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: SignupForm) => {
    setError(null)
    setIsLoading(true)

    try {
      await signupRequest({
        fullName: values.fullName,
        username: values.email,
        password: values.password,
        recoveryEmail: values.email,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const apiError = handleApiError(err)
      setError(apiError.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-500 via-teal-500 to-blue-500 px-4 py-12">
        <Card className="w-full max-w-md shadow-2xl text-center">
          <div className="mb-4 text-6xl">✓</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Account Created!
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Redirecting to login...
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-500 via-teal-500 to-blue-500 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Create Account</h1>
        <p className="text-white/90">Join Vanna Insight Engine</p>
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
            <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Full Name"
            type="text"
            {...register('fullName')}
            error={errors.fullName?.message}
            disabled={isLoading}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
            disabled={isLoading}
          />
          <Input
            label="Password"
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
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
