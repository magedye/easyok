/**
 * Custom Hook: useApiCatalog
 * Manages API Catalog state and operations with caching & error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios, { type AxiosRequestConfig } from 'axios'
import { useState, useCallback } from 'react'
import { ApiCatalogService, DEFAULT_API_CATALOG } from '@/services/apiCatalogService'
import { useAuthStore } from '@/stores/authStore'
import type {
  ApiCatalog,
  ApiCatalogVersion,
  ApiEndpoint,
  ApiConnection,
  CreateEndpointRequest,
  UpdateEndpointRequest,
  CreateConnectionRequest,
  UpdateConnectionRequest,
} from '@/types/apiCatalog'

const CATALOG_QUERY_KEY = ['api-catalog']
const ENDPOINTS_QUERY_KEY = ['api-catalog', 'endpoints']
const CONNECTIONS_QUERY_KEY = ['api-catalog', 'connections']
const VERSIONS_QUERY_KEY = ['api-catalog', 'versions']

/**
 * Hook to fetch and manage the current API catalog
 */
export function useApiCatalog() {
  const queryClient = useQueryClient()
  const [syncError, setSyncError] = useState<string | null>(null)

  const {
    data: catalog,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: async () => {
      try {
        return await ApiCatalogService.getCatalog()
      } catch (err) {
        console.warn('Failed to fetch catalog, using default', err)
        setSyncError((err as Error).message)
        return DEFAULT_API_CATALOG
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
  }, [queryClient])

  return {
    catalog: catalog || DEFAULT_API_CATALOG,
    isLoading,
    error: error ? (error as Error).message : syncError,
    refetch,
    invalidate,
  }
}

/**
 * Hook to fetch and manage endpoints
 */
export function useApiEndpoints(filters?: { tags?: string[]; method?: string; deprecated?: boolean }) {
  const queryClient = useQueryClient()

  const {
    data: endpoints = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...ENDPOINTS_QUERY_KEY, filters],
    queryFn: () => ApiCatalogService.listEndpoints(filters),
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 2,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateEndpointRequest) => ApiCatalogService.createEndpoint(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENDPOINTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateEndpointRequest) => ApiCatalogService.updateEndpoint(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENDPOINTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (endpointId: string) => ApiCatalogService.deleteEndpoint(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENDPOINTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  return {
    endpoints,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  }
}

/**
 * Hook to fetch and manage connections
 */
export function useApiConnections() {
  const queryClient = useQueryClient()

  const {
    data: connections = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: CONNECTIONS_QUERY_KEY,
    queryFn: () => ApiCatalogService.listConnections(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateConnectionRequest) => ApiCatalogService.createConnection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateConnectionRequest) => ApiCatalogService.updateConnection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) => ApiCatalogService.deleteConnection(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const testMutation = useMutation({
    mutationFn: (connectionId: string) => ApiCatalogService.testConnection(connectionId),
  })

  return {
    connections,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    test: testMutation,
  }
}

/**
 * Hook to manage catalog versions
 */
export function useCatalogVersions() {
  const queryClient = useQueryClient()

  const {
    data: versions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: VERSIONS_QUERY_KEY,
    queryFn: () => ApiCatalogService.getCatalogVersions(50),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  })

  const publishMutation = useMutation({
    mutationFn: (versionId: string) => ApiCatalogService.publishVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const previewMutation = useMutation({
    mutationFn: (versionId: string) => ApiCatalogService.previewVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => ApiCatalogService.rollbackVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
    },
  })

  return {
    versions,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    publish: publishMutation,
    preview: previewMutation,
    rollback: rollbackMutation,
  }
}

/**
 * Hook to manage catalog imports/exports
 */
export function useCatalogImportExport() {
  const queryClient = useQueryClient()

  const importOpenApiMutation = useMutation({
    mutationFn: (specFile: File | string) => ApiCatalogService.importOpenApiSpec(specFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ENDPOINTS_QUERY_KEY })
    },
  })

  const exportOpenApiMutation = useMutation({
    mutationFn: (versionId?: string) => ApiCatalogService.exportAsOpenApi(versionId),
  })

  const exportJsonMutation = useMutation({
    mutationFn: (versionId?: string) => ApiCatalogService.exportAsJson(versionId),
  })

  return {
    importOpenApi: importOpenApiMutation,
    exportOpenApi: exportOpenApiMutation,
    exportJson: exportJsonMutation,
  }
}

/**
 * Hook for catalog validation
 */
export function useCatalogValidation() {
  const validateMutation = useMutation({
    mutationFn: (versionId?: string) => ApiCatalogService.validateCatalog(versionId),
  })

  return {
    validate: validateMutation,
  }
}

/**
 * Hook to build and execute catalog-defined requests at runtime
 * Centralizes URL construction, path params, and auth headers
 */
export function useCatalogRequest() {
  const { catalog } = useApiCatalog()
  const { token } = useAuthStore()

  const buildRequest = async (
    endpointId: string,
    data?: Record<string, unknown>,
    options?: AxiosRequestConfig,
  ) => {
    const endpoint = catalog?.currentVersion?.endpoints.find((e) => e.id === endpointId)
    if (!endpoint) {
      throw new Error(`Endpoint not found in catalog: ${endpointId}`)
    }

    const defaultConnection = catalog.currentVersion?.connections?.find((c) => c.isDefault)
    const defaultBaseUrlConfig = catalog.currentVersion?.baseUrls?.find((b) => b.isDefault)
    const baseUrl = defaultConnection?.baseUrl || defaultBaseUrlConfig?.url

    if (!baseUrl) {
      throw new Error('No default base URL configured in catalog')
    }

    let path = endpoint.path
    const bodyData: Record<string, unknown> = {}

    Object.entries(data || {}).forEach(([key, value]) => {
      if (path.includes(`{${key}}`)) {
        path = path.replace(`{${key}}`, String(value))
      } else {
        bodyData[key] = value
      }
    })

    const url = `${baseUrl}${path}`

    const config: AxiosRequestConfig = {
      method: endpoint.method,
      url,
      ...options,
      headers: {
        ...options?.headers,
      },
    }

    if (endpoint.authRequired) {
      if (!token) {
        throw new Error('Authentication required but no token available')
      }
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` }
    }

    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      config.data = bodyData
    } else if (endpoint.method === 'GET') {
      config.params = bodyData
    }

    return axios(config)
  }

  return { buildRequest }
}

/**
 * Hook to sync catalog changes across sessions
 */
export function useCatalogSync() {
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const syncMutation = useMutation({
    mutationFn: async () => {
      const syncState = await ApiCatalogService.getSyncState()
      return syncState
    },
    onSuccess: () => {
      setLastSyncedAt(new Date().toISOString())
    },
  })

  return {
    lastSyncedAt,
    sync: syncMutation,
  }
}
