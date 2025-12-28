import clsx from 'classnames'

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={clsx('animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800', className)} />
)
