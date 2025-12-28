/**
 * ConnectionList.tsx
 * Display all backend connections with status indicators and filters
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § ConnectionManager
 * Phase 2b: Week 2 deliverable
 */

import { useState, useMemo } from 'react'
import { useApiConnections } from '@/hooks/useApiCatalog'
import type { ApiConnection } from '@/types/apiCatalog'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import clsx from 'classnames'

interface ConnectionListProps {
  onEdit?: (connection: ApiConnection) => void
  onDelete?: (connection: ApiConnection) => void
  onTest?: (connection: ApiConnection) => void
  onCreate?: () => void
}

const AUTH_TYPE_COLORS = {
  none: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  bearer: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  apiKey: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  basic: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  oauth2: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
}

const AUTH_TYPE_LABELS = {
  none: 'None',
  bearer: 'Bearer Token',
  apiKey: 'API Key',
  basic: 'Basic Auth',
  oauth2: 'OAuth 2.0',
}

export function ConnectionList({ onEdit, onDelete, onTest, onCreate }: ConnectionListProps) {
  const { connections, isLoading, error } = useApiConnections()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [authTypeFilter, setAuthTypeFilter] = useState<string>('all')
  const [healthStatus, setHealthStatus] = useState<Record<string, 'healthy' | 'warning' | 'error' | 'unknown'>>({})

  // Filter connections
  const filteredConnections = useMemo(() => {
    if (!connections) return []
    
    return connections.filter(connection => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        connection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.description?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Auth type filter
      const matchesAuthType = authTypeFilter === 'all' || connection.authType === authTypeFilter
      
      return matchesSearch && matchesAuthType
    })
  }, [connections, searchQuery, authTypeFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  if (error) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-danger">Failed to load connections: {String(error)}</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            API Connections
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {filteredConnections.length} of {connections?.length || 0} connections
          </p>
        </div>
        {onCreate && (
          <Button onClick={onCreate} variant="primary">
            + New Connection
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <Input
                type="text"
                placeholder="Search by name or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Auth Type Filter */}
            <div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                value={authTypeFilter}
                onChange={(e) => setAuthTypeFilter(e.target.value)}
              >
                <option value="all">All Auth Types</option>
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="apiKey">API Key</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="p-6 text-center">
            <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">Loading connections...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && filteredConnections.length === 0 && (
        <Card>
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-neutral-900 dark:text-white">
              No connections found
            </h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {searchQuery || authTypeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating a new connection'}
            </p>
            {onCreate && !searchQuery && authTypeFilter === 'all' && (
              <Button onClick={onCreate} variant="primary" className="mt-4">
                Create First Connection
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Connection Grid */}
      {!isLoading && filteredConnections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConnections.map((connection) => {
            const status = healthStatus[connection.id] || 'unknown'
            
            return (
              <Card key={connection.id}>
                <div className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-neutral-900 dark:text-white truncate">
                          {connection.name}
                        </h3>
                        {connection.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                            Default
                          </span>
                        )}
                      </div>
                      {connection.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                          {connection.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Base URL */}
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                      Base URL
                    </p>
                    <code className="text-sm font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded break-all block">
                      {connection.baseUrl}
                    </code>
                  </div>

                  {/* Auth Type */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Authentication
                    </span>
                    <span
                      className={clsx(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        AUTH_TYPE_COLORS[connection.authType]
                      )}
                    >
                      {AUTH_TYPE_LABELS[connection.authType]}
                    </span>
                  </div>

                  {/* Health Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Status
                    </span>
                    <span
                      className={clsx(
                        'inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getStatusColor(status)
                      )}
                    >
                      {getStatusIcon(status)}
                      <span className="capitalize">{status}</span>
                    </span>
                  </div>

                  {/* Tags */}
                  {connection.tags && connection.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {connection.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                        >
                          {tag}
                        </span>
                      ))}
                      {connection.tags.length > 3 && (
                        <span className="text-xs text-neutral-500">
                          +{connection.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    {onTest && (
                      <button
                        onClick={() => onTest(connection)}
                        className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
                      >
                        Test Connection
                      </button>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(connection)}
                          className="p-2 text-neutral-600 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400"
                          aria-label="Edit connection"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(connection)}
                          className="p-2 text-neutral-600 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
                          aria-label="Delete connection"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ConnectionList
