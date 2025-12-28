/**
 * EndpointPreview.tsx
 * Display formatted endpoint summary with request/response examples
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § EndpointManager
 * Phase 2b: Week 1 deliverable
 */

import type { ApiEndpoint, HttpMethod, JsonSchema } from '@/types/apiCatalog'
import { Card } from '@/components/shared/Card'
import { useState } from 'react'
import { generateExampleData } from '@/utils/formGenerator'
import clsx from 'classnames'

interface EndpointPreviewProps {
  endpoint: ApiEndpoint
  baseUrl?: string
  onClose?: () => void
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-blue-500',
  POST: 'bg-green-500',
  PUT: 'bg-yellow-500',
  PATCH: 'bg-orange-500',
  DELETE: 'bg-red-500',
}

export function EndpointPreview({ endpoint, baseUrl = 'https://api.example.com', onClose }: EndpointPreviewProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const fullUrl = `${baseUrl}${endpoint.path}`
  
  // Generate example data
  const exampleRequest = endpoint.examples?.request || 
    (endpoint.requestSchema ? generateExampleData(endpoint.requestSchema) : null)
  
  const exampleResponse = endpoint.examples?.response || 
    (endpoint.responseSchema ? generateExampleData(endpoint.responseSchema) : null)

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSection(section)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const renderSchemaProperties = (schema: JsonSchema) => {
    if (!schema?.properties) return null

    return (
      <div className="space-y-2">
        {Object.entries(schema.properties).map(([key, prop]) => (
          <div key={key} className="flex items-start space-x-3">
            <code className="text-sm font-mono text-brand-600 dark:text-brand-400">
              {key}
            </code>
            <span className="text-sm text-neutral-500">
              {prop.type}
              {schema.required?.includes(key) && (
                <span className="ml-2 text-red-500">*</span>
              )}
            </span>
            {prop.description && (
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                — {prop.description}
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <span
              className={clsx(
                'inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold text-white',
                METHOD_COLORS[endpoint.method]
              )}
            >
              {endpoint.method}
            </span>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {endpoint.name}
            </h2>
            {endpoint.deprecated && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Deprecated
              </span>
            )}
          </div>
          {endpoint.description && (
            <p className="text-neutral-600 dark:text-neutral-400">
              {endpoint.description}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* URL */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
              Endpoint URL
            </h3>
            <button
              onClick={() => copyToClipboard(fullUrl, 'url')}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {copiedSection === 'url' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <code className="block p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-mono text-neutral-900 dark:text-neutral-100 break-all">
            {fullUrl}
          </code>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Authentication */}
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
              Authentication
            </h3>
            <div className="flex items-center space-x-2">
              {endpoint.authRequired ? (
                <>
                  <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">Required</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">Not Required</span>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Tags */}
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
              Tags
            </h3>
            {endpoint.tags && endpoint.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {endpoint.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-neutral-400">No tags</span>
            )}
          </div>
        </Card>

        {/* Rate Limit */}
        {endpoint.rateLimit && (
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
                Rate Limit
              </h3>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {endpoint.rateLimit.requests} requests per {endpoint.rateLimit.windowMs / 1000}s
              </p>
            </div>
          </Card>
        )}

        {/* Timeout */}
        {endpoint.timeout && (
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
                Timeout
              </h3>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {endpoint.timeout}ms
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Request Schema */}
      {endpoint.requestSchema && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                Request Schema
              </h3>
            </div>
            {renderSchemaProperties(endpoint.requestSchema)}
          </div>
        </Card>
      )}

      {/* Request Example */}
      {exampleRequest && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                Request Example
              </h3>
              <button
                onClick={() => copyToClipboard(JSON.stringify(exampleRequest, null, 2), 'request')}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {copiedSection === 'request' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 bg-neutral-900 dark:bg-black rounded-lg text-sm font-mono text-green-400 overflow-x-auto">
              {JSON.stringify(exampleRequest, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Response Schema */}
      {endpoint.responseSchema && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                Response Schema
              </h3>
            </div>
            {renderSchemaProperties(endpoint.responseSchema)}
          </div>
        </Card>
      )}

      {/* Response Example */}
      {exampleResponse && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                Response Example
              </h3>
              <button
                onClick={() => copyToClipboard(JSON.stringify(exampleResponse, null, 2), 'response')}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {copiedSection === 'response' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 bg-neutral-900 dark:bg-black rounded-lg text-sm font-mono text-blue-400 overflow-x-auto">
              {JSON.stringify(exampleResponse, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* cURL Example */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
              cURL Example
            </h3>
            <button
              onClick={() => {
                const curlCommand = `curl -X ${endpoint.method} "${fullUrl}"${
                  endpoint.authRequired ? ' \\\n  -H "Authorization: Bearer YOUR_TOKEN"' : ''
                }${
                  exampleRequest
                    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(exampleRequest)}'`
                    : ''
                }`
                copyToClipboard(curlCommand, 'curl')
              }}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {copiedSection === 'curl' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-neutral-900 dark:bg-black rounded-lg text-sm font-mono text-yellow-400 overflow-x-auto">
{`curl -X ${endpoint.method} "${fullUrl}"${
  endpoint.authRequired ? ' \\\n  -H "Authorization: Bearer YOUR_TOKEN"' : ''
}${
  exampleRequest
    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(exampleRequest)}'`
    : ''
}`}
          </pre>
        </div>
      </Card>
    </div>
  )
}

export default EndpointPreview
