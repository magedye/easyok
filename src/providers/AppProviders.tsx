import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { ToastProvider } from '@/components/shared/Toast'
import i18n from '@/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Initialize MSW in browser
const initializeMSW = async () => {
  if (import.meta.env.VITE_ENABLE_MSW !== 'false') {
    try {
      const { worker } = await import('@/mocks/browser')
      await worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
      })
      console.log('MSW initialized successfully')
    } catch (error) {
      console.warn('MSW initialization warning:', error)
      // Don't block the app if MSW fails
    }
  }
}

// Initialize MSW on app load
initializeMSW()

const AppProvidersContent = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>{children}</ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

export const AppProviders = ({ children }: PropsWithChildren) => (
  <AppProvidersContent>{children}</AppProvidersContent>
)
