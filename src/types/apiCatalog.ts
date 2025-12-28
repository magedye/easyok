/**
 * API Catalog Type Definitions
 * Defines the structure for managing backend endpoints, schemas, and configurations
 */

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// Catalog Roles for RBAC
export type CatalogRole = 'catalog_viewer' | 'catalog_editor' | 'catalog_publisher' | 'admin'

export interface CatalogPermissions {
  canView: boolean
  canEdit: boolean
  canPublish: boolean
  canDelete: boolean
  canManageRoles: boolean
}

// Environment Type
export type EnvironmentType = 'dev' | 'staging' | 'prod' | 'test'

// Parameter/Schema Types
export interface SchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  required?: boolean
  enum?: (string | number)[]
  default?: unknown
  items?: SchemaProperty
  properties?: Record<string, SchemaProperty>
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
}

export interface JsonSchema {
  type: 'object'
  properties: Record<string, SchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

// Endpoint/Route Definition
export interface ApiEndpoint {
  id: string
  name: string
  description?: string
  path: string
  method: HttpMethod
  baseUrlKey?: string // Reference to a connection
  tags?: string[]
  authRequired?: boolean
  deprecated?: boolean
  requestSchema?: JsonSchema
  responseSchema?: JsonSchema
  errorSchema?: JsonSchema
  examples?: {
    request?: Record<string, unknown>
    response?: Record<string, unknown>
    error?: Record<string, unknown>
  }
  rateLimit?: {
    requests: number
    windowMs: number
  }
  timeout?: number
}

// Base URL Configuration (Environment-specific)
export interface BaseUrlConfig {
  env: EnvironmentType
  url: string
  description?: string
  isDefault?: boolean
}

// Connection/Base URL Configuration (Legacy - kept for backward compatibility)
export interface ApiConnection {
  id: string
  name: string
  description?: string
  baseUrl: string
  authType: 'none' | 'bearer' | 'apiKey' | 'basic' | 'oauth2'
  authConfig?: {
    header?: string
    token?: string
    username?: string
    password?: string
    clientId?: string
    clientSecret?: string
    tokenUrl?: string
  }
  headers?: Record<string, string>
  tags?: string[]
  isDefault?: boolean
  testEndpoint?: string
  healthCheckInterval?: number
}

// Version & Catalog
export interface ApiCatalogVersion {
  id: string
  versionNumber: string
  createdAt: string
  createdBy: string
  description?: string
  status: 'draft' | 'preview' | 'published'
  baseUrls: BaseUrlConfig[]
  endpoints: ApiEndpoint[]
  schemas: Record<string, JsonSchema>
  connections?: ApiConnection[] // Legacy support
  changes?: Array<{
    action: 'added' | 'updated' | 'deleted'
    type: 'endpoint' | 'connection' | 'schema'
    id: string
    details?: Record<string, unknown>
  }>
}

export interface ApiCatalog {
  id: string
  name: string
  description?: string
  currentVersionId: string
  currentVersion?: ApiCatalogVersion
  versions?: ApiCatalogVersion[]
  baseUrls: BaseUrlConfig[]
  schemas: Record<string, JsonSchema>
  updatedAt: string
  updatedBy: string
  tags?: string[]
}

// Form Generation & Validation
export interface FormField {
  name: string
  type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'json'
  label: string
  description?: string
  required: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string | number }>
  validation?: {
    minLength?: number
    maxLength?: number
    minimum?: number
    maximum?: number
    pattern?: string
    custom?: (value: unknown) => boolean | string
  }
}

export interface FormSchema {
  fields: FormField[]
  layout?: 'vertical' | 'horizontal' | 'inline'
  sections?: Array<{
    title: string
    fields: string[]
  }>
}

// Validation Result
export interface ValidationResult {
  valid: boolean
  errors?: Array<{
    field: string
    message: string
  }>
  warnings?: Array<{
    field: string
    message: string
  }>
}

// Audit & Sync
export interface CatalogAuditLog {
  id: string
  userId: string
  action: 'create' | 'update' | 'delete' | 'publish' | 'preview'
  resourceType: 'endpoint' | 'connection' | 'version'
  resourceId: string
  versionId: string
  timestamp: string
  changes?: Record<string, { before: unknown; after: unknown }>
  status: 'success' | 'failure'
  details?: Record<string, unknown>
}

export interface SyncState {
  lastSyncedAt: string
  isOutOfDate: boolean
  pendingChanges: string[]
  conflicts?: Array<{
    resourceId: string
    serverVersion: unknown
    localVersion: unknown
  }>
}

// Admin UI Request/Response
export interface CreateEndpointRequest {
  name: string
  path: string
  method: HttpMethod
  baseUrlKey?: string
  description?: string
  requestSchema?: JsonSchema
  responseSchema?: JsonSchema
  authRequired?: boolean
}

export interface UpdateEndpointRequest extends Partial<CreateEndpointRequest> {
  id: string
}

export interface CreateConnectionRequest {
  name: string
  baseUrl: string
  authType: 'none' | 'bearer' | 'apiKey' | 'basic' | 'oauth2'
  authConfig?: Record<string, string>
  description?: string
}

export interface UpdateConnectionRequest extends Partial<CreateConnectionRequest> {
  id: string
}

// OpenAPI/Swagger Integration
export interface OpenApiSpec {
  openapi: string
  info: {
    title: string
    description?: string
    version: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, Record<string, unknown>>
  components?: {
    schemas?: Record<string, unknown>
  }
}

// Config Sync Message (WebSocket/SSE)
export interface CatalogSyncMessage {
  type: 'update' | 'delete' | 'publish' | 'conflict'
  resourceType: 'endpoint' | 'connection' | 'version'
  resourceId: string
  versionId: string
  timestamp: string
  data?: unknown
  metadata?: Record<string, unknown>
}

// Health Check Result
export interface HealthCheckResult {
  connectionId: string
  healthy: boolean
  statusCode?: number
  responseTime?: number
  lastCheckedAt: string
  error?: string
}

// Admin Settings
export interface CatalogAdminSettings {
  autoValidate: boolean
  autoHealthCheck: boolean
  healthCheckInterval: number
  enableWebSocketSync: boolean
  fallbackToDefaults: boolean
  requireApprovalForPublish: boolean
  auditLogRetentionDays: number
}
