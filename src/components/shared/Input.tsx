import type { InputHTMLAttributes } from 'react'
import clsx from 'classnames'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = ({ label, error, hint, className, id, ...props }: InputProps) => (
  <div className="space-y-1">
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {label}
      </label>
    )}
    <input
      id={id}
      className={clsx(
        'w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white',
        error && 'border-danger focus:border-danger focus:ring-danger/30',
        className,
      )}
      {...props}
    />
    {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
)
