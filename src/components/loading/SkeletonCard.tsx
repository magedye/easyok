export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
      <div className="h-4 bg-neutral-300 dark:bg-neutral-600 rounded w-3/4 mb-3"></div>
      <div className="h-4 bg-neutral-300 dark:bg-neutral-600 rounded w-1/2 mb-3"></div>
      <div className="h-4 bg-neutral-300 dark:bg-neutral-600 rounded w-5/6"></div>
    </div>
  )
}

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full">
        <thead className="bg-neutral-50 dark:bg-neutral-800">
          <tr>
            {[1, 2, 3, 4].map((i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 bg-neutral-300 dark:bg-neutral-600 rounded animate-pulse"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-neutral-200 dark:border-neutral-700">
              {[1, 2, 3, 4].map((j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-neutral-300 dark:bg-neutral-600 rounded animate-pulse"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const SkeletonStat: React.FC = () => {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
      <div className="h-3 bg-neutral-300 dark:bg-neutral-600 rounded w-1/2 mb-2"></div>
      <div className="h-8 bg-neutral-300 dark:bg-neutral-600 rounded w-3/4"></div>
    </div>
  )
}
