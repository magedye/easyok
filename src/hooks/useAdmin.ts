import { useMutation, useQuery as useReactQuery } from '@tanstack/react-query'
import * as adminService from '@/services/adminService'
import type { PaginationParams } from '@/types'
import { useToast } from '@/components/shared/Toast'

const ADMIN_CACHE_TIME = 1000 * 60 * 5 // 5 minutes
const ADMIN_STALE_TIME = 1000 * 60 // 1 minute

const isPlannedResponse = (
  response: unknown,
): response is { status: 'planned'; message: string } =>
  typeof response === 'object' &&
  response !== null &&
  'status' in response &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (response as any).status === 'planned'

const notifyPlanned = (
  toast: ReturnType<typeof useToast>,
  response: unknown,
  title: string,
) => {
  if (isPlannedResponse(response)) {
    toast.showToast({
      title,
      description: response.message,
      variant: 'info',
    })
    return true
  }
  return false
}

/**
 * Hook to fetch admin statistics
 */
export const useAdminStats = () => {
  return useReactQuery({
    queryKey: ['adminStats'],
    queryFn: adminService.getAdminStats,
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to fetch audit logs
 */
export const useAuditLogs = (params?: PaginationParams) => {
  return useReactQuery({
    queryKey: ['auditLogs', params],
    queryFn: () => adminService.getAuditLogs(params),
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to fetch all users
 */
export const useAllUsers = (params?: PaginationParams) => {
  return useReactQuery({
    queryKey: ['allUsers', params],
    queryFn: () => adminService.getAllUsers(params),
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to fetch user by ID
 */
export const useUserById = (userId: string) => {
  return useReactQuery({
    queryKey: ['user', userId],
    queryFn: () => adminService.getUserById(userId),
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
    enabled: !!userId,
  })
}

/**
 * Hook to update user role
 */
export const useUpdateUserRole = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'analyst' | 'admin' | 'viewer' }) =>
      adminService.updateUserRole(userId, role),
    onSuccess: () => {
      toast.showToast({
        title: 'User role updated',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to update user role',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to disable user
 */
export const useDisableUser = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.disableUser,
    onSuccess: () => {
      toast.showToast({
        title: 'User disabled',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to disable user',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to enable user
 */
export const useEnableUser = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.enableUser,
    onSuccess: () => {
      toast.showToast({
        title: 'User enabled',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to enable user',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to fetch database schema
 */
export const useDatabaseSchema = () => {
  return useReactQuery({
    queryKey: ['databaseSchema'],
    queryFn: adminService.getDatabaseSchema,
    staleTime: ADMIN_CACHE_TIME,
    gcTime: ADMIN_CACHE_TIME * 2,
  })
}

/**
 * Hook to refresh schema cache
 */
export const useRefreshSchema = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.refreshSchemaCache,
    onSuccess: () => {
      toast.showToast({
        title: 'Schema refreshed',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to refresh schema',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to fetch system health
 */
export const useSystemHealth = () => {
  return useReactQuery({
    queryKey: ['systemHealth'],
    queryFn: adminService.getSystemHealth,
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to fetch system metrics
 */
export const useSystemMetrics = () => {
  return useReactQuery({
    queryKey: ['systemMetrics'],
    queryFn: adminService.getSystemMetrics,
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to export audit logs
 */
export const useExportAuditLogs = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: ({ format, filters }: { format: 'csv' | 'json'; filters?: Record<string, unknown> }) =>
      adminService.exportAuditLogs(format, filters),
    onSuccess: (blob, { format }) => {
      // Trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.showToast({
        title: 'Audit logs exported',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to export audit logs',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to get system configuration
 */
export const useSystemConfig = () => {
  return useReactQuery({
    queryKey: ['systemConfig'],
    queryFn: adminService.getSystemConfig,
    staleTime: ADMIN_CACHE_TIME,
    gcTime: ADMIN_CACHE_TIME * 2,
  })
}

/**
 * Hook to update system configuration
 */
export const useUpdateSystemConfig = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.updateSystemConfig,
    onSuccess: (data: unknown) => {
      if (!notifyPlanned(toast, data, 'Live config toggles unavailable')) {
        toast.showToast({
          title: 'Configuration updated',
          variant: 'success',
        })
      }
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to update configuration',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to approve SQL (planned)
 */
export const useApproveSqlAction = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.approveSql,
    onSuccess: (response: unknown) => {
      if (!notifyPlanned(toast, response, 'SQL approval coming soon')) {
        toast.showToast({
          title: 'SQL approved',
          variant: 'success',
        })
      }
    },
  })

  return mutation
}

/**
 * Hook to fetch governance training data
 */
export const useTrainingData = () => {
  return useReactQuery({
    queryKey: ['trainingData'],
    queryFn: adminService.getTrainingData,
    staleTime: ADMIN_STALE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to approve feedback for training
 */
export const useApproveTrainingData = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.approveTrainingData,
    onSuccess: () => {
      toast.showToast({
        title: 'Training data approved',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to approve feedback',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to reload schema (dbt sync)
 */
export const useReloadSchema = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.reloadSchema,
    onSuccess: () => {
      toast.showToast({
        title: 'Schema reload triggered',
        variant: 'success',
      })
    },
    onError: () => {
      toast.showToast({
        title: 'Failed to reload schema',
        variant: 'error',
      })
    },
  })

  return mutation
}

/**
 * Hook to fetch feedback metrics
 */
export const useFeedbackMetrics = () => {
  return useReactQuery({
    queryKey: ['feedbackMetrics'],
    queryFn: adminService.getFeedbackMetrics,
    staleTime: ADMIN_CACHE_TIME,
    gcTime: ADMIN_CACHE_TIME,
  })
}

/**
 * Hook to manage scheduled reports (planned)
 */
export const useScheduledReports = () => {
  const toast = useToast()

  return useReactQuery({
    queryKey: ['scheduledReports'],
    queryFn: adminService.listScheduledReports,
    staleTime: ADMIN_CACHE_TIME,
    gcTime: ADMIN_CACHE_TIME,
    onSuccess: (response: unknown) => {
      notifyPlanned(toast, response, 'Scheduled reports coming soon')
    },
  } as any)
}

export const useCreateScheduledReport = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: adminService.createScheduledReport,
    onSuccess: (response: unknown) => {
      if (!notifyPlanned(toast, response, 'Scheduled reports coming soon')) {
        toast.showToast({
          title: 'Scheduled report created',
          variant: 'success',
        })
      }
    },
  })

  return mutation
}

export const useDeleteScheduledReport = () => {
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: (reportId: string) => adminService.deleteScheduledReport(reportId),
    onSuccess: (response: unknown) => {
      if (!notifyPlanned(toast, response, 'Scheduled reports coming soon')) {
        toast.showToast({
          title: 'Scheduled report deleted',
          variant: 'success',
        })
      }
    },
  })

  return mutation
}
