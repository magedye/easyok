/**
 * EndpointList.tsx
 * Display paginated list of API endpoints with filtering and quick actions
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § EndpointManager
 * Phase 2b: Week 1 deliverable
 */

import { useState, useMemo, useRef } from 'react'
import { useApiEndpoints } from '@/hooks/useApiCatalog'
import type { ApiEndpoint, HttpMethod } from '@/types/apiCatalog'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import clsx from 'classnames'

interface EndpointListProps {
  onEdit?: (endpoint: ApiEndpoint) => void
  onDelete?: (endpoint: ApiEndpoint) => void
  onTest?: (endpoint: ApiEndpoint) => void
  onCreate?: () => void
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  POST: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export function EndpointList({ onEdit, onDelete, onTest, onCreate }: EndpointListProps) {
  const { endpoints, isLoading, error } = useApiEndpoints()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<HttpMethod | 'all'>('all')
  const [showDeprecated, setShowDeprecated] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return []
    
    return endpoints.filter(endpoint => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.description?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Method filter
      const matchesMethod = methodFilter === 'all' || endpoint.method === methodFilter
      
      // Deprecated filter
      const matchesDeprecated = showDeprecated || !endpoint.deprecated
      
      return matchesSearch && matchesMethod && matchesDeprecated
    })
  }, [endpoints, searchQuery, methodFilter, showDeprecated])

  // Pagination
  const totalPages = Math.ceil(filteredEndpoints.length / itemsPerPage)
  const paginatedEndpoints = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredEndpoints.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredEndpoints, currentPage])

  // Reset pagination when filters change - derived state approach
  const filtersChanged = useMemo(() => {
    return currentPage > 1 && filteredEndpoints.length > 0
  }, [currentPage, filteredEndpoints.length])
  
  // Simple effect for pagination reset
  const prevFiltersRef = useRef({ searchQuery, methodFilter, showDeprecated })
  if (
    prevFiltersRef.current.searchQuery !== searchQuery ||
    prevFiltersRef.current.methodFilter !== methodFilter ||
    prevFiltersRef.current.showDeprecated !== showDeprecated
  ) {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
    prevFiltersRef.current = { searchQuery, methodFilter, showDeprecated }
  }

  if (error) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-danger">Failed to load endpoints: {String(error)}</p>
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
            API Endpoints
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {filteredEndpoints.length} of {endpoints?.length || 0} endpoints
          </p>
        </div>
        {onCreate && (
          <Button onClick={onCreate} variant="primary">
            + New Endpoint
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <Input
                type="text"
                placeholder="Search by name, path, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Method Filter */}
            <div>
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as HttpMethod | 'all')}
              >
                <option value="all">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>

          {/* Show Deprecated Checkbox */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDeprecated}
              onChange={(e) => setShowDeprecated(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Show deprecated endpoints
            </span>
          </label>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="p-6 text-center">
            <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">Loading endpoints...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && paginatedEndpoints.length === 0 && (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-neutral-900 dark:text-white">
              No endpoints found
            </h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {searchQuery || methodFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating a new endpoint'}
            </p>
            {onCreate && !searchQuery && methodFilter === 'all' && (
              <Button onClick={onCreate} variant="primary" className="mt-4">
                Create First Endpoint
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Endpoint List */}
      {!isLoading && paginatedEndpoints.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Path
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {paginatedEndpoints.map((endpoint) => (
                  <tr
                    key={endpoint.id}
                    className={clsx(
                      'hover:bg-neutral-50 dark:hover:bg-neutral-800 transition',
                      endpoint.deprecated && 'opacity-60'
                    )}
                  >
                    {/* Method */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          METHOD_COLORS[endpoint.method]
                        )}
                      >
                        {endpoint.method}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {endpoint.name}
                        </span>
                        {endpoint.authRequired && (
                          <svg
                            className="h-4 w-4 text-neutral-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-label="Authentication required"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        )}
                      </div>
                      {endpoint.description && (
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-md">
                          {endpoint.description}
                        </p>
                      )}
                    </td>

                    {/* Path */}
                    <td className="px-6 py-4">
                      <code className="text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                        {endpoint.path}
                      </code>
                    </td>

                    {/* Tags */}
                    <td className="px-6 py-4">
                      {endpoint.tags && endpoint.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {endpoint.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                            >
                              {tag}
                            </span>
                          ))}
                          {endpoint.tags.length > 2 && (
                            <span className="text-xs text-neutral-500">
                              +{endpoint.tags.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-sm">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {endpoint.deprecated ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Deprecated
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end space-x-2">
                        {onTest && (
                          <button
                            onClick={() => onTest(endpoint)}
                            className="text-neutral-600 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400"
                            title="Test endpoint"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(endpoint)}
                            className="text-neutral-600 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400"
                            title="Edit endpoint"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(endpoint)}
                            className="text-neutral-600 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
                            title="Delete endpoint"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 px-6 py-4">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default EndpointList
