import type { PropsWithChildren, ReactNode } from 'react'
import clsx from 'classnames'

interface CardProps extends PropsWithChildren {
  title?: string
  description?: string
  icon?: ReactNode
  className?: string
  action?: ReactNode
}

export const Card = ({ children, title, description, icon, className, action }: CardProps) => (
  <div
    className={clsx(
      'rounded-2xl border border-neutral-100 bg-white/90 p-6 shadow-soft-card backdrop-blur dark:border-neutral-800 dark:bg-neutral-900',
      className,
    )}
  >
    {(title || description || icon || action) && (
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          {icon && <div className="text-brand-500">{icon}</div>}
          {title && <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{title}</h3>}
          {description && <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
)
