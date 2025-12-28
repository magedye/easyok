import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/loading/Spinner'
import {
  getQueryById,
  exportQueryResults,
  saveQueryAsFavorite,
  removeFavorite,
  deleteQuery,
} from '@/services/queryService'
import { submitFeedback } from '@/services/feedbackService'
import { handleApiError } from '@/utils/errorHandler'

export const QueryDetailPage = () => {
  const { t } = useTranslation()
  const { queryId } = useParams<{ queryId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: query, isLoading, error: queryError } = useQuery({
    queryKey: ['query', queryId],
    queryFn: () => getQueryById(queryId!),
    enabled: !!queryId,
  })

  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'json' | 'xlsx') => exportQueryResults(queryId!, format),
    onSuccess: (blob, format) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `query-${queryId}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onError: (err) => {
      const apiError = handleApiError(err)
      setError(apiError.message)
    },
  })

  const favoriteMutation = useMutation({
    mutationFn: () => 
      query?.isFavorite ? removeFavorite(queryId!) : saveQueryAsFavorite(queryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query', queryId] })
      queryClient.invalidateQueries({ queryKey: ['query-history'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuery(queryId!),
    onSuccess: () => {
      navigate('/history')
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        queryId: queryId!,
        rating: feedback === 'positive' ? 5 : 1,
        comment: feedbackComment,
      }),
    onSuccess: () => {
      setFeedbackComment('')
      alert('Thank you for your feedback!')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (queryError || !query) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Query Not Found</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              The requested query could not be found.
            </p>
            <Link to="/history">
              <Button variant="primary">Back to History</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const queryResults = query.results

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            Query Details
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {new Date(query.createdAt || Date.now()).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => favoriteMutation.mutate()}
            disabled={favoriteMutation.isPending}
          >
            {query.isFavorite ? '⭐ Favorited' : '☆ Favorite'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/history')}
          >
            Back to History
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
          <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Query Metadata */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <p className="text-sm text-neutral-500">Status</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {query.status || 'Success'}
          </p>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <p className="text-sm text-neutral-500">Duration</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {query.executionTime || '0'}ms
          </p>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <p className="text-sm text-neutral-500">Rows Returned</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {query.rowCount || 0}
          </p>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <p className="text-sm text-neutral-500">Confidence</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {query.confidence ? `${(query.confidence * 100).toFixed(0)}%` : 'N/A'}
          </p>
        </Card>
      </div>

      {/* Natural Language Question */}
      <Card title="Question">
        <p className="text-neutral-900 dark:text-white">
          {query.question || 'No question provided'}
        </p>
      </Card>

      {/* SQL Query */}
      <Card title="Generated SQL">
        <pre className="bg-neutral-900 dark:bg-neutral-950 text-green-400 p-4 rounded-md overflow-x-auto">
          <code>{query.sql || 'No SQL available'}</code>
        </pre>
      </Card>

      {/* Results */}
      {queryResults && (
        <Card 
          title="Results" 
          description={`${query.rowCount || 0} rows returned`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  {queryResults.columns?.map((col: string, idx: number) => (
                    <th key={idx} className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResults.rows?.slice(0, 10).map((row: Record<string, unknown>, idx: number) => (
                  <tr key={idx} className="border-t border-neutral-200 dark:border-neutral-700">
                    {queryResults.columns?.map((col: string, colIdx: number) => (
                      <td key={colIdx} className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                        {(row[col] as string | number | undefined)?.toString() || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {(query.rowCount || 0) > 10 && (
              <p className="text-sm text-neutral-500 mt-2">
                Showing 10 of {query.rowCount} rows
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Export Options */}
      <Card title="Export Results">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => exportMutation.mutate('csv')}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export as CSV'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportMutation.mutate('json')}
            disabled={exportMutation.isPending}
          >
            Export as JSON
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportMutation.mutate('xlsx')}
            disabled={exportMutation.isPending}
          >
            Export as Excel
          </Button>
        </div>
      </Card>

      {/* Feedback Section */}
      <Card title="Feedback" description="Help us improve our SQL generation">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant={feedback === 'positive' ? 'primary' : 'secondary'}
              onClick={() => setFeedback('positive')}
            >
              👍 Good Result
            </Button>
            <Button
              variant={feedback === 'negative' ? 'primary' : 'secondary'}
              onClick={() => setFeedback('negative')}
            >
              👎 Poor Result
            </Button>
          </div>
          {feedback && (
            <div className="space-y-3">
              <textarea
                placeholder="Tell us more about your experience (optional)"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
                rows={3}
              />
              <Button
                variant="primary"
                onClick={() => feedbackMutation.mutate()}
                disabled={feedbackMutation.isPending}
              >
                {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card title="Danger Zone">
        <Button
          variant="secondary"
          onClick={() => {
            if (confirm('Are you sure you want to delete this query?')) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Query'}
        </Button>
      </Card>
    </div>
  )
}
