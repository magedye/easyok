import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { useTranslation } from 'react-i18next'
import { getQueryHistory, deleteQuery } from '@/services/queryService'
import { SkeletonCard } from '@/components/loading/SkeletonCard'

export const HistoryPage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')
  const isRtl = i18n.dir() === 'rtl'

  const { data: history, isLoading } = useQuery({
    queryKey: ['query-history', filter],
    queryFn: () => getQueryHistory(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteQuery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-history'] })
    },
  })

  const filteredQueries = history?.items?.filter((q: any) => {
    if (filter === 'all') return true
    if (filter === 'success') return q.status === 'success' || !q.status
    if (filter === 'failed') return q.status === 'failed' || q.status === 'error'
    return true
  }) || []

  return (
    <div className={clsx('space-y-6', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          {t('history.title') || 'Query History'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          {t('history.subtitle') || 'Your past queries and results'}
        </p>
        <div className={clsx('flex flex-wrap gap-2', isRtl && 'justify-end')}>
          {(['all', 'success', 'failed'] as const).map((value) => (
            <Button
              key={value}
              variant={filter === value ? 'primary' : 'secondary'}
              onClick={() => setFilter(value)}
              className="px-4"
            >
              {value === 'all' ? 'All' : value === 'success' ? 'Success' : 'Failed'}
            </Button>
          ))}
        </div>
      </div>

      <Card title={t('dashboard.recentQueries.title') || 'Recent Queries'}>
        {isLoading ? (
          <SkeletonCard />
        ) : filteredQueries.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredQueries.map((q: any) => (
              <div
                key={q.id}
                className="cursor-pointer rounded-2xl border border-neutral-100 bg-neutral-50 p-4 shadow-sm transition hover:border-blue-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                onClick={() => navigate(`/query/${q.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {q.question || `${q.sql?.substring(0, 80)}...`}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(q.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      q.status === 'success' || !q.status
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                    )}
                  >
                    {q.status || 'success'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
                  <span>{t('history.columns.duration') || 'Duration'}: {q.executionTime || 0}ms</span>
                  <span>•</span>
                  <span>{t('history.columns.rows') || 'Rows'}: {q.rowCount || 0}</span>
                  {q.status === 'failed' || q.status === 'error' ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      SECURITY_VIOLATION / ERROR
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/query/${q.id}`)
                    }}
                  >
                    {t('history.viewDetails') || 'View Details'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this query?')) {
                        deleteMutation.mutate(q.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {t('common.delete') || 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="mb-4 text-neutral-500 dark:text-neutral-400">
              {t('history.empty') || 'No queries found'}
            </p>
            <Button variant="primary" onClick={() => navigate('/dashboard')}>
              {t('history.cta') || 'Create Your First Query'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
