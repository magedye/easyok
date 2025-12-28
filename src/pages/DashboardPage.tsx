import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { useTranslation } from 'react-i18next'
import { getAnalytics, generateQuery, executeQuery, getQueryHistory } from '@/services/queryService'
import { SkeletonStat, SkeletonCard } from '@/components/loading/SkeletonCard'
import { Spinner } from '@/components/loading/Spinner'
import { handleApiError } from '@/utils/errorHandler'

export const DashboardPage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isRtl = i18n.dir() === 'rtl'

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
  })

  const { data: recentQueries, isLoading: historyLoading } = useQuery({
    queryKey: ['query-history-recent'],
    queryFn: () => getQueryHistory(),
  })

  const generateMutation = useMutation({
    mutationFn: async (question: string) => {
      const generated = await generateQuery({ question })
      const executed = await executeQuery({ sql: generated.sql })
      return { ...generated, ...executed }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['query-history-recent'] })
      setQuestion('')
      setError(null)
    },
    onError: (err) => {
      const apiError = handleApiError(err)
      setError(apiError.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim()) {
      generateMutation.mutate(question)
    }
  }

  return (
    <div className={clsx('space-y-10', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-black text-neutral-900 dark:text-white">Vanna Insight Engine</h1>
        <p className="text-lg text-neutral-500 dark:text-neutral-400">{t('slogan')}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analyticsLoading ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <Card className="border border-neutral-100 shadow-sm">
              <p className="text-sm text-neutral-500">{t('dashboard.stats.totalQueries')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">
                {analytics?.totalQueries?.toLocaleString() || 0}
              </p>
            </Card>
            <Card className="border border-neutral-100 shadow-sm">
              <p className="text-sm text-neutral-500">{t('dashboard.stats.averageTime')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">
                {analytics?.averageExecutionTime?.toFixed(0) || 0}ms
              </p>
            </Card>
            <Card className="border border-neutral-100 shadow-sm">
              <p className="text-sm text-neutral-500">{t('dashboard.stats.successRate')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">
                {analytics && analytics.totalQueries > 0
                  ? `${((analytics.successfulQueries / analytics.totalQueries) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </Card>
            <Card className="border border-neutral-100 shadow-sm">
              <p className="text-sm text-neutral-500">{t('dashboard.stats.successfulQueries') || 'Successful Queries'}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">
                {analytics?.successfulQueries?.toLocaleString() || 0}
              </p>
            </Card>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
          {t('common.quickActions')}
        </h2>
        <Card>
          <div className={clsx('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', isRtl && 'text-right')}>
            <Button className="w-full" variant="primary">
              {t('dashboard.quickActions.tryExample')}
            </Button>
            <Button className="w-full" variant="secondary" onClick={() => navigate('/history')}>
              {t('dashboard.quickActions.viewHistory') || 'View History'}
            </Button>
            <Button className="w-full" variant="secondary" onClick={() => navigate('/schema')}>
              {t('dashboard.quickActions.browseSchema') || 'Browse Schema'}
            </Button>
            <Button className="w-full" variant="secondary" onClick={() => navigate('/settings')}>
              {t('common.settings') || 'Settings'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card
          title={t('query.title') || 'Quick Ask'}
          description={t('dashboard.queryInput.placeholder') || 'Ask in natural language; governance will handle SQL'}
        >
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              placeholder={t('dashboard.queryInput.placeholder') || 'Ask a question in natural language'}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={generateMutation.isPending}
            />
            <Button
              className="w-full"
              variant="primary"
              type="submit"
              disabled={generateMutation.isPending || !question.trim()}
            >
              {generateMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  {t('dashboard.queryInput.submit') || 'Generate'}
                </span>
              ) : (
                t('dashboard.queryInput.submit') || 'Generate'
              )}
            </Button>
          </form>
        </Card>

        <Card title={t('common.activeOperations')}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm">{t('common.running')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="text-sm text-neutral-500">{t('common.noActiveQueries')}</span>
            </div>
          </div>
        </Card>

        <Card title={t('common.qualityIndicators')}>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{t('common.queryAccuracy')}</span>
                <span className="text-sm font-semibold text-green-600">98%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div className="h-2 rounded-full bg-green-500" style={{ width: '98%' }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{t('common.systemHealth')}</span>
                <span className="text-sm font-semibold text-green-600">96%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div className="h-2 rounded-full bg-green-500" style={{ width: '96%' }} />
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t('dashboard.suggestions.title')}
          description={t('common.basedOnRecent')}
        >
          <div className="space-y-2">
            <div className="rounded-md bg-blue-50 p-3 text-sm font-medium text-neutral-900 dark:bg-blue-900/20 dark:text-white">
              {t('common.suggestion1')}
            </div>
            <div className="rounded-md bg-blue-50 p-3 text-sm font-medium text-neutral-900 dark:bg-blue-900/20 dark:text-white">
              {t('common.suggestion2')}
            </div>
          </div>
        </Card>

        <Card
          title={t('dashboard.recentQueries.title') || 'Recent Queries'}
          description={t('common.lastQueries') || 'Your latest queries'}
        >
          {historyLoading ? (
            <SkeletonCard />
          ) : recentQueries?.items && recentQueries.items.length > 0 ? (
            <div className="space-y-2">
              {recentQueries.items.slice(0, 5).map((query: any) => (
                <div
                  key={query.id}
                  className="flex cursor-pointer items-start justify-between gap-2 rounded border border-neutral-100 bg-neutral-50 p-3 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                  onClick={() => navigate(`/query/${query.id}`)}
                >
                  <div className="flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {query.question || `${query.sql?.substring(0, 50)}...`}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(query.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'rounded px-2 py-1 text-xs font-medium',
                      query.status === 'success' || !query.status
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                    )}
                  >
                    {query.status || 'success'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{t('history.empty') || 'No recent queries'}</p>
          )}
        </Card>
      </section>
    </div>
  )
}
