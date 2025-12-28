/**
 * HealthCheck.tsx
 * Trigger connection health test and display results
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § ConnectionManager
 * Phase 2b: Week 2 deliverable
 */

import { useState } from 'react'
import type { ApiConnection } from '@/types/apiCatalog'
import { Button } from '@/components/shared/Button'
import { Card } from '@/components/shared/Card'
import clsx from 'classnames'

export interface HealthCheckDisplayResult {
  status: 'success' | 'error' | 'warning'
  latency?: number
  statusCode?: number
  message: string
  timestamp: string
  details?: {
    headers?: Record<string, string>
    body?: unknown
  }
}

interface HealthCheckProps {
  connection: ApiConnection
  onTest?: (connectionId: string) => Promise<HealthCheckDisplayResult>
}

export function HealthCheck({ connection, onTest }: HealthCheckProps) {
  const [isTesting, setIsTesting] = useState(false)
  const [result, setResult] = useState<HealthCheckDisplayResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    setIsTesting(true)
    setError(null)
    setResult(null)

    try {
      if (onTest) {
        const testResult = await onTest(connection.id)
        setResult(testResult)
      } else {
        // Mock test result for demonstration
        await new Promise((resolve) => setTimeout(resolve, 2000))
        
        const mockResult: HealthCheckDisplayResult = {
          status: 'success',
          latency: Math.floor(Math.random() * 500) + 50,
          statusCode: 200,
          message: 'Connection successful',
          timestamp: new Date().toISOString(),
        }
        setResult(mockResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connection')
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusIcon = (status: HealthCheckDisplayResult['status']) => {
    switch (status) {
      case 'success':
        return (
          <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getStatusBadgeClass = (status: HealthCheckDisplayResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    }
  }

  const formatLatency = (latency: number) => {
    if (latency < 1000) {
      return `${latency}ms`
    }
    return `${(latency / 1000).toFixed(2)}s`
  }

  return (
    <div className="space-y-4">
      {/* Connection Info */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Test Connection
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Connection
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                {connection.name}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Base URL
              </span>
              <code className="text-sm font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                {connection.baseUrl}
              </code>
            </div>

            {connection.testEndpoint && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Test Endpoint
                </span>
                <code className="text-sm font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                  {connection.testEndpoint}
                </code>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Auth Type
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                {connection.authType === 'none' ? 'None' :
                 connection.authType === 'bearer' ? 'Bearer Token' :
                 connection.authType === 'apiKey' ? 'API Key' :
                 connection.authType === 'basic' ? 'Basic Auth' :
                 'OAuth 2.0'}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleTest}
              isLoading={isTesting}
              variant="primary"
              className="w-full"
            >
              {isTesting ? 'Testing Connection...' : 'Run Health Check'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card>
          <div className="p-6">
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-900 dark:text-red-300">
                  Test Failed
                </h4>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Success Result */}
      {result && (
        <Card>
          <div className="p-6">
            {/* Status Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center mb-3">
                {getStatusIcon(result.status)}
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                {result.message}
              </h3>
              <span
                className={clsx(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                  getStatusBadgeClass(result.status)
                )}
              >
                Status: {result.status.toUpperCase()}
              </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {result.latency !== undefined && (
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    Latency
                  </p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {formatLatency(result.latency)}
                  </p>
                </div>
              )}

              {result.statusCode !== undefined && (
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    Status Code
                  </p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {result.statusCode}
                  </p>
                </div>
              )}

              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                  Timestamp
                </p>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Details */}
            {result.details && (
              <div className="space-y-3">
                {result.details.headers && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Response Headers
                    </h4>
                    <pre className="p-3 bg-neutral-900 dark:bg-black rounded-lg text-xs font-mono text-green-400 overflow-x-auto">
                      {JSON.stringify(result.details.headers, null, 2)}
                    </pre>
                  </div>
                )}

                {result.details.body !== undefined && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Response Body
                    </h4>
                    <pre className="p-3 bg-neutral-900 dark:bg-black rounded-lg text-xs font-mono text-blue-400 overflow-x-auto max-h-64">
                      {typeof result.details.body === 'object' 
                        ? JSON.stringify(result.details.body, null, 2)
                        : String(result.details.body)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {result.status === 'warning' && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                  Recommendations
                </h4>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                  <li>Check if the endpoint is responding slowly</li>
                  <li>Verify authentication credentials</li>
                  <li>Review server logs for warnings</li>
                </ul>
              </div>
            )}

            {result.status === 'error' && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-900 dark:text-red-300 mb-2">
                  Troubleshooting
                </h4>
                <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                  <li>Verify the base URL is correct and accessible</li>
                  <li>Check network connectivity and firewall rules</li>
                  <li>Ensure authentication credentials are valid</li>
                  <li>Review CORS settings if testing from browser</li>
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Help Text */}
      {!result && !error && !isTesting && (
        <Card>
          <div className="p-6">
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
                  About Health Checks
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  The health check will send a request to the configured test endpoint (or base URL) to verify:
                </p>
                <ul className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 space-y-1 list-disc list-inside">
                  <li>The connection is reachable</li>
                  <li>Authentication is working correctly</li>
                  <li>Response time is within acceptable limits</li>
                  <li>The server is responding with valid data</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default HealthCheck
