import { useMutation, useQuery as useReactQuery } from '@tanstack/react-query'
import * as queryService from '@/services/queryService'
import * as feedbackService from '@/services/feedbackService'
import { useToast } from '@/components/shared/Toast'

const QUERY_CACHE_TIME = 1000 * 60 * 5 // 5 minutes
const QUERY_STALE_TIME = 1000 * 60 * 2 // 2 minutes

/**
 * Hook to generate SQL from natural language
 */
export const useGenerateQuery = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: queryService.generateQuery,
    onError: (error) => {
      toast.showToast({
        title: 'Failed to generate query',
        variant: 'error',
      })
      console.error('Generate query error:', error)
    },
  })

  return mutation
}

/**
 * Hook to execute SQL query
 */
export const useExecuteQuery = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: queryService.executeQuery,
    onError: (error) => {
      toast.showToast({
        title: 'Failed to execute query',
        variant: 'error',
      })
      console.error('Execute query error:', error)
    },
  })

  return mutation
}

/**
 * Hook to validate SQL query
 */
export const useValidateQuery = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: queryService.validateQuery,
    onError: (error) => {
      console.error('Validate query error:', error)
    },
  })

  return mutation
}

/**
 * Hook to fetch query history
 */
export const useQueryHistory = () => {
  return useReactQuery({
    queryKey: ['queryHistory'],
    queryFn: () => queryService.getQueryHistory(),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
  })
}

/**
 * Hook to fetch single query
 */
export const useQueryById = (id: string) => {
  return useReactQuery({
    queryKey: ['query', id],
    queryFn: () => queryService.getQueryById(id),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
    enabled: !!id,
  })
}

/**
 * Hook to fetch analytics
 */
export const useAnalytics = () => {
  return useReactQuery({
    queryKey: ['analytics'],
    queryFn: queryService.getAnalytics,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
  })
}

/**
 * Hook to submit query feedback
 */
export const useSubmitFeedback = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: feedbackService.submitFeedback,
    onSuccess: () => {
      toast.showToast({
        title: 'Feedback submitted',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to submit feedback',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to export query results
 */
export const useExportResults = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: ({ queryId, format }: { queryId: string; format: 'csv' | 'json' | 'xlsx' }) =>
      queryService.exportQueryResults(queryId, format),
    onSuccess: (blob, { format, queryId }) => {
      // Trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `query-${queryId}.${format === 'xlsx' ? 'xlsx' : format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.showToast({
        title: 'Query exported successfully',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to export query',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to get follow-up suggestions
 */
export const useFollowUpSuggestions = (queryId: string) => {
  return useReactQuery({
    queryKey: ['suggestions', queryId],
    queryFn: () => queryService.getFollowUpSuggestions(queryId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
    enabled: !!queryId,
  })
}

/**
 * Hook to save/remove favorites
 */
export const useFavorite = () => {
  const toast = useToast()

  const save = useMutation({
    mutationFn: queryService.saveQueryAsFavorite,
    onSuccess: () => {
      toast.showToast({
        title: 'Added to favorites',
        variant: 'success',
      })
    },
  })

  const remove = useMutation({
    mutationFn: queryService.removeFavorite,
    onSuccess: () => {
      toast.showToast({
        title: 'Removed from favorites',
        variant: 'success',
      })
    },
  })

  return { save, remove }
}

/**
 * Hook to delete query
 */
export const useDeleteQuery = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: queryService.deleteQuery,
    onSuccess: () => {
      toast.showToast({
        title: 'Query deleted',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to delete query',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to get query explanation
 */
export const useQueryExplanation = (sql: string) => {
  return useReactQuery({
    queryKey: ['explanation', sql],
    queryFn: () => queryService.getQueryExplanation(sql),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
    enabled: !!sql,
  })
}
