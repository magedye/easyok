import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'classnames'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
  secondary:
    'bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-brand-600 hover:bg-brand-50 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg',
}

export const Button = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  disabled,
  ...props
}: ButtonProps) => (
  <button
    className={clsx(
      'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70',
      variantClasses[variant],
      sizeClasses[size],
      className,
    )}
    disabled={disabled ?? isLoading}
    {...props}
  >
    {isLoading && (
      <span className="me-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-b-transparent" />
    )}
    {leftIcon && <span className="ms-2 text-lg">{leftIcon}</span>}
    {children}
  </button>
)
