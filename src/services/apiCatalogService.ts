/**
 * API Catalog Service
 * Manages the catalog of endpoints, connections, and versioning
 */

import { apiClient } from './apiClient'
import type {
  ApiCatalog,
  ApiCatalogVersion,
  ApiEndpoint,
  ApiConnection,
  CatalogAuditLog,
  HealthCheckResult,
  CreateEndpointRequest,
  UpdateEndpointRequest,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  SyncState,
} from '@/types/apiCatalog'

const CATALOG_BASE_URL = '/admin/api-catalog'
const DEFAULT_TIMEOUT = 30000

export class ApiCatalogService {
  /**
   * Fetch the current API catalog
   */
  static async getCatalog(): Promise<ApiCatalog> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}`, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Fetch catalog by version ID
   */
  static async getCatalogVersion(versionId: string): Promise<ApiCatalogVersion> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/versions/${versionId}`, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Get all versions of the catalog
   */
  static async getCatalogVersions(limit = 50): Promise<ApiCatalogVersion[]> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/versions`, {
      params: { limit },
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data.versions || []
  }

  /**
   * Create a new endpoint
   */
  static async createEndpoint(payload: CreateEndpointRequest): Promise<ApiEndpoint> {
    const response = await apiClient.post(`${CATALOG_BASE_URL}/endpoints`, payload, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Update an existing endpoint
   */
  static async updateEndpoint(payload: UpdateEndpointRequest): Promise<ApiEndpoint> {
    const { id, ...data } = payload
    const response = await apiClient.put(`${CATALOG_BASE_URL}/endpoints/${id}`, data, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Delete an endpoint
   */
  static async deleteEndpoint(endpointId: string): Promise<void> {
    await apiClient.delete(`${CATALOG_BASE_URL}/endpoints/${endpointId}`, {
      timeout: DEFAULT_TIMEOUT,
    })
  }

  /**
   * Get a single endpoint
   */
  static async getEndpoint(endpointId: string): Promise<ApiEndpoint> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/endpoints/${endpointId}`, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * List all endpoints (with optional filtering)
   */
  static async listEndpoints(filters?: {
    tags?: string[]
    method?: string
    deprecated?: boolean
  }): Promise<ApiEndpoint[]> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/endpoints`, {
      params: filters,
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data.endpoints || []
  }

  /**
   * Create a new connection
   */
  static async createConnection(payload: CreateConnectionRequest): Promise<ApiConnection> {
    const response = await apiClient.post(`${CATALOG_BASE_URL}/connections`, payload, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Update an existing connection
   */
  static async updateConnection(payload: UpdateConnectionRequest): Promise<ApiConnection> {
    const { id, ...data } = payload
    const response = await apiClient.put(`${CATALOG_BASE_URL}/connections/${id}`, data, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Delete a connection
   */
  static async deleteConnection(connectionId: string): Promise<void> {
    await apiClient.delete(`${CATALOG_BASE_URL}/connections/${connectionId}`, {
      timeout: DEFAULT_TIMEOUT,
    })
  }

  /**
   * Get a single connection
   */
  static async getConnection(connectionId: string): Promise<ApiConnection> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/connections/${connectionId}`, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * List all connections
   */
  static async listConnections(): Promise<ApiConnection[]> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/connections`, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data.connections || []
  }

  /**
   * Test a connection (health check)
   */
  static async testConnection(connectionId: string): Promise<HealthCheckResult> {
    const response = await apiClient.post(
      `${CATALOG_BASE_URL}/connections/${connectionId}/test`,
      {},
      { timeout: DEFAULT_TIMEOUT }
    )
    return response.data
  }

  /**
   * Validate catalog configuration
   */
  static async validateCatalog(versionId?: string): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await apiClient.post(
      `${CATALOG_BASE_URL}/validate`,
      versionId ? { versionId } : {},
      { timeout: DEFAULT_TIMEOUT }
    )
    return response.data
  }

  /**
   * Publish a catalog version (draft → published)
   */
  static async publishVersion(versionId: string): Promise<ApiCatalogVersion> {
    const response = await apiClient.post(
      `${CATALOG_BASE_URL}/versions/${versionId}/publish`,
      {},
      { timeout: DEFAULT_TIMEOUT }
    )
    return response.data
  }

  /**
   * Preview a catalog version (before publishing)
   */
  static async previewVersion(versionId: string): Promise<ApiCatalogVersion> {
    const response = await apiClient.post(
      `${CATALOG_BASE_URL}/versions/${versionId}/preview`,
      {},
      { timeout: DEFAULT_TIMEOUT }
    )
    return response.data
  }

  /**
   * Rollback to a previous version
   */
  static async rollbackVersion(versionId: string): Promise<ApiCatalogVersion> {
    const response = await apiClient.post(
      `${CATALOG_BASE_URL}/versions/${versionId}/rollback`,
      {},
      { timeout: DEFAULT_TIMEOUT }
    )
    return response.data
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(filters?: {
    resourceType?: string
    resourceId?: string
    userId?: string
    limit?: number
    offset?: number
  }): Promise<{ logs: CatalogAuditLog[]; total: number }> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/audit-logs`, {
      params: filters,
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Get sync state for the current session
   */
  static async getSyncState(): Promise<SyncState> {
    const response = await apiClient.get(`${CATALOG_BASE_URL}/sync-state`, {
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  }

  /**
   * Import OpenAPI spec and create/update endpoints
   */
  static async importOpenApiSpec(specFile: File | string): Promise<{
    imported: number
    updated: number
    errors?: string[]
  }> {
    const formData = new FormData()
    if (specFile instanceof File) {
      formData.append('file', specFile)
    } else {
      formData.append('spec', specFile)
    }

    const response = await apiClient.post(
      `${CATALOG_BASE_URL}/import/openapi`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: DEFAULT_TIMEOUT,
      }
    )
    return response.data
  }

  /**
   * Export catalog as OpenAPI spec
   */
  static async exportAsOpenApi(versionId?: string): Promise<Blob> {
    const response = await apiClient.get(
      `${CATALOG_BASE_URL}/export/openapi`,
      {
        params: versionId ? { versionId } : undefined,
        responseType: 'blob',
        timeout: DEFAULT_TIMEOUT,
      }
    )
    return response.data
  }

  /**
   * Export catalog as JSON
   */
  static async exportAsJson(versionId?: string): Promise<Blob> {
    const response = await apiClient.get(
      `${CATALOG_BASE_URL}/export/json`,
      {
        params: versionId ? { versionId } : undefined,
        responseType: 'blob',
        timeout: DEFAULT_TIMEOUT,
      }
    )
    return response.data
  }
}

/**
 * Fallback/Default Catalog
 * Bundled with the app for offline functionality
 */
export const DEFAULT_API_CATALOG: ApiCatalog = {
  id: 'default-catalog',
  name: 'Default API Catalog',
  description: 'Fallback catalog bundled with the application',
  currentVersionId: 'v1-default',
  baseUrls: [
    { env: 'dev', url: 'http://localhost:8000/api/v1', isDefault: true }
  ],
  schemas: {},
  currentVersion: {
    id: 'v1-default',
    versionNumber: '1.0.0',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    description: 'Default bundled catalog',
    status: 'published',
    baseUrls: [
      { env: 'dev', url: 'http://localhost:8000/api/v1', isDefault: true }
    ],
    schemas: {},
    endpoints: [
      {
        id: 'query-generate',
        name: 'Generate SQL Query',
        path: '/queries/generate',
        method: 'POST',
        description: 'Generate SQL from natural language',
        authRequired: true,
        requestSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Natural language question' },
            context: { type: 'string', description: 'Optional context' },
          },
          required: ['question'],
        },
        responseSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            explanation: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
      {
        id: 'query-execute',
        name: 'Execute SQL Query',
        path: '/queries/execute',
        method: 'POST',
        description: 'Execute a SQL query',
        authRequired: true,
        requestSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL query to execute' },
            limit: { type: 'integer', description: 'Result limit' },
          },
          required: ['sql'],
        },
        responseSchema: {
          type: 'object',
          properties: {
            results: { type: 'array' },
            rowCount: { type: 'integer' },
            executionTime: { type: 'number' },
          },
        },
      },
    ],
    connections: [
      {
        id: 'default-connection',
        name: 'Default Backend',
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
        authType: 'bearer',
        isDefault: true,
      },
    ],
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
}
