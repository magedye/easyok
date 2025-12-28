/**
 * ConnectionForm.tsx
 * Generic form for creating/editing connections
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § ConnectionManager
 * Phase 2b: Week 2 deliverable
 */

import { useState } from 'react'
import type { ApiConnection } from '@/types/apiCatalog'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'
import { CredentialValidator } from './CredentialValidator'

interface ConnectionFormProps {
  connection?: ApiConnection
  onSubmit: (data: Partial<ApiConnection>) => void | Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

export function ConnectionForm({ connection, onSubmit, onCancel, isSubmitting }: ConnectionFormProps) {
  const [formData, setFormData] = useState<Partial<ApiConnection>>({
    name: connection?.name || '',
    description: connection?.description || '',
    baseUrl: connection?.baseUrl || '',
    authType: connection?.authType || 'none',
    authConfig: connection?.authConfig || {},
    headers: connection?.headers || {},
    tags: connection?.tags || [],
    isDefault: connection?.isDefault ?? false,
    testEndpoint: connection?.testEndpoint,
    healthCheckInterval: connection?.healthCheckInterval,
    ...connection,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tagInput, setTagInput] = useState('')
  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.baseUrl?.trim()) {
      newErrors.baseUrl = 'Base URL is required'
    } else {
      try {
        new URL(formData.baseUrl)
      } catch {
        newErrors.baseUrl = 'Invalid URL format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    await onSubmit(formData)
  }

  const updateField = <K extends keyof ApiConnection>(
    field: K,
    value: ApiConnection[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _removed, ...rest } = prev
        return rest
      })
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      updateField('tags', [...(formData.tags || []), tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    updateField('tags', formData.tags?.filter((t) => t !== tag) || [])
  }

  const addHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      updateField('headers', {
        ...formData.headers,
        [headerKey.trim()]: headerValue.trim(),
      })
      setHeaderKey('')
      setHeaderValue('')
    }
  }

  const removeHeader = (key: string) => {
    const { [key]: _removed, ...rest } = formData.headers || {}
    updateField('headers', rest)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Basic Information
          </h3>

          <Input
            id="name"
            label="Connection Name"
            placeholder="e.g., Production API"
            value={formData.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            error={errors.name}
            required
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Optional description of this connection"
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>
        </div>
      </Card>

      {/* Connection Settings */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Connection Settings
          </h3>

          <Input
            id="baseUrl"
            label="Base URL"
            placeholder="https://api.example.com/v1"
            value={formData.baseUrl || ''}
            onChange={(e) => updateField('baseUrl', e.target.value)}
            error={errors.baseUrl}
            hint="The root URL for this API connection"
            required
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
              Authentication Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.authType || 'none'}
              onChange={(e) => updateField('authType', e.target.value as ApiConnection['authType'])}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              required
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="apiKey">API Key</option>
              <option value="basic">Basic Authentication</option>
              <option value="oauth2">OAuth 2.0</option>
            </select>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isDefault ?? false}
              onChange={(e) => updateField('isDefault', e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Set as default connection
            </span>
          </label>
        </div>
      </Card>

      {/* Authentication Credentials */}
      <CredentialValidator
        authType={formData.authType || 'none'}
        authConfig={formData.authConfig}
        onChange={(authConfig) => updateField('authConfig', authConfig)}
      />

      {/* Advanced Settings */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Advanced Settings
          </h3>

          <Input
            id="testEndpoint"
            label="Test Endpoint"
            placeholder="/health"
            value={formData.testEndpoint || ''}
            onChange={(e) => updateField('testEndpoint', e.target.value)}
            hint="Endpoint path to use for health checks (relative to base URL)"
          />

          <Input
            id="healthCheckInterval"
            type="number"
            label="Health Check Interval (ms)"
            placeholder="60000"
            value={formData.healthCheckInterval || ''}
            onChange={(e) => updateField('healthCheckInterval', parseInt(e.target.value) || undefined)}
            hint="How often to run automatic health checks (e.g., 60000ms = 1 minute)"
          />
        </div>
      </Card>

      {/* Custom Headers */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Custom Headers
          </h3>

          {/* Existing Headers */}
          {formData.headers && Object.keys(formData.headers).length > 0 && (
            <div className="space-y-2 mb-4">
              {Object.entries(formData.headers).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                      {key}: {value}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHeader(key)}
                    className="ml-2 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="header-key"
              placeholder="Header name"
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addHeader()
                }
              }}
            />
            <div className="flex items-end space-x-2">
              <Input
                id="header-value"
                placeholder="Header value"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addHeader()
                  }
                }}
              />
              <Button type="button" onClick={addHeader} variant="secondary" size="sm">
                Add
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tags */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Tags
          </h3>

          <div className="flex items-center space-x-2">
            <Input
              id="tag-input"
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <Button type="button" onClick={addTag} variant="secondary" size="sm">
              Add
            </Button>
          </div>

          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-600 dark:hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {connection ? 'Update Connection' : 'Create Connection'}
        </Button>
      </div>
    </form>
  )
}

export default ConnectionForm
