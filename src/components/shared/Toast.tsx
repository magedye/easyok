import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { createPortal } from 'react-dom'
import clsx from 'classnames'
import { generateId } from '@/utils/helpers'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-success text-success',
  error: 'border-danger text-danger',
  info: 'border-brand-500 text-brand-600',
}

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = generateId()
      setToasts((prev) => [...prev, { ...toast, id, variant: toast.variant ?? 'info' }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-4 flex flex-col items-center gap-3 px-4 sm:items-end sm:pe-6">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={clsx(
                'pointer-events-auto w-full max-w-sm rounded-2xl border bg-white/95 px-4 py-3 text-right shadow-xl backdrop-blur',
                toast.variant ? variantStyles[toast.variant] : variantStyles.info,
              )}
            >
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && <p className="text-xs text-neutral-500">{toast.description}</p>}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
