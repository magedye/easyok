/**
 * EndpointForm.tsx
 * Generic form builder for endpoint creation/editing
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § EndpointManager
 * Phase 2b: Week 1 deliverable
 */

import { useState } from 'react'
import type { ApiEndpoint, HttpMethod } from '@/types/apiCatalog'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'

interface EndpointFormProps {
  endpoint?: ApiEndpoint
  onSubmit: (data: Partial<ApiEndpoint>) => void | Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

export function EndpointForm({ endpoint, onSubmit, onCancel, isSubmitting }: EndpointFormProps) {
  const [formData, setFormData] = useState<Partial<ApiEndpoint>>({
    name: endpoint?.name || '',
    description: endpoint?.description || '',
    path: endpoint?.path || '',
    method: endpoint?.method || 'GET',
    authRequired: endpoint?.authRequired ?? true,
    deprecated: endpoint?.deprecated ?? false,
    tags: endpoint?.tags || [],
    timeout: endpoint?.timeout,
    ...endpoint,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tagInput, setTagInput] = useState('')

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.path?.trim()) {
      newErrors.path = 'Path is required'
    } else if (!formData.path.startsWith('/')) {
      newErrors.path = 'Path must start with /'
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

  const updateField = <K extends keyof ApiEndpoint>(
    field: K,
    value: ApiEndpoint[K]
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
            label="Endpoint Name"
            placeholder="e.g., Generate SQL Query"
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
              placeholder="Optional description of what this endpoint does"
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>
        </div>
      </Card>

      {/* HTTP Configuration */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            HTTP Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
                HTTP Method <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.method || 'GET'}
                onChange={(e) => updateField('method', e.target.value as HttpMethod)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                required
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <Input
              id="path"
              label="Path"
              placeholder="/queries/generate"
              value={formData.path || ''}
              onChange={(e) => updateField('path', e.target.value)}
              error={errors.path}
              hint="Use {param} for path parameters, e.g., /users/{userId}"
              required
            />
          </div>

          <Input
            id="baseUrlKey"
            label="Base URL Key"
            placeholder="main-api"
            value={formData.baseUrlKey || ''}
            onChange={(e) => updateField('baseUrlKey', e.target.value)}
            hint="Reference to a connection (optional)"
          />
        </div>
      </Card>

      {/* Security & Settings */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Security & Settings
          </h3>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.authRequired ?? true}
              onChange={(e) => updateField('authRequired', e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Authentication required
            </span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.deprecated ?? false}
              onChange={(e) => updateField('deprecated', e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Mark as deprecated
            </span>
          </label>

          <Input
            id="timeout"
            type="number"
            label="Timeout (ms)"
            placeholder="5000"
            value={formData.timeout || ''}
            onChange={(e) => updateField('timeout', parseInt(e.target.value) || undefined)}
            hint="Optional request timeout in milliseconds"
          />
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

      {/* Rate Limiting */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Rate Limiting (Optional)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="rateLimit-requests"
              type="number"
              label="Max Requests"
              placeholder="100"
              value={formData.rateLimit?.requests || ''}
              onChange={(e) =>
                updateField('rateLimit', {
                  requests: parseInt(e.target.value) || 0,
                  windowMs: formData.rateLimit?.windowMs || 60000,
                })
              }
            />

            <Input
              id="rateLimit-window"
              type="number"
              label="Window (ms)"
              placeholder="60000"
              value={formData.rateLimit?.windowMs || ''}
              onChange={(e) =>
                updateField('rateLimit', {
                  requests: formData.rateLimit?.requests || 100,
                  windowMs: parseInt(e.target.value) || 60000,
                })
              }
              hint="60000ms = 1 minute"
            />
          </div>
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
          {endpoint ? 'Update Endpoint' : 'Create Endpoint'}
        </Button>
      </div>
    </form>
  )
}

export default EndpointForm
