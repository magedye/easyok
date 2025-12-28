import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useLocation, type Location, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import { useAuth } from '@/context/AuthContext'
import { handleApiError } from '@/utils/errorHandler'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type LoginForm = z.infer<typeof schema>

export const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(redirectPath, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const onSubmit = async (values: LoginForm) => {
    setError(null)
    setIsLoading(true)
    
    try {
      await login({
        username: values.email,
        password: values.password,
      })
    } catch (err) {
      const apiError = handleApiError(err)
      setError(apiError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Vanna Insight Engine</h1>
        <p className="text-white/90">{t('login.subtitle') || 'Sign in to access your insights'}</p>
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
            <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label={t('login.email') || 'Email'}
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
            disabled={isLoading}
          />
          <Input
            label={t('login.password') || 'Password'}
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
            disabled={isLoading}
          />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span className="text-neutral-600 dark:text-neutral-400">{t('login.rememberMe') || 'Remember me'}</span>
            </label>
            <Link to="/forgot-password" className="text-blue-600 hover:underline">
              {t('login.forgotPassword') || 'Forgot password?'}
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (t('login.loading') || 'Loading...') : (t('login.submit') || 'Sign In')}
          </Button>
        
        </form>
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('login.noAccount') || "Don't have an account?"}{' '}
            <Link to="/signup" className="text-blue-600 hover:underline font-semibold">
              {t('login.signUp') || 'Sign up'}
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
