import * as Sentry from '@sentry/react'

let initialized = false

const getNumberEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const isSentryEnabled = () => Boolean(import.meta.env.VITE_SENTRY_DSN)

export const initMonitoring = () => {
  if (initialized || !isSentryEnabled()) return

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [],
    tracesSampleRate: getNumberEnv(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
    release: import.meta.env.VITE_APP_VERSION,
  })

  initialized = true
}

export const captureException = (error: unknown, context?: Record<string, unknown>) => {
  if (!initialized || !isSentryEnabled()) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}
