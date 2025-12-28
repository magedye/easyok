/**
 * PayloadMapper.tsx
 * Map request fields to schema properties with type/format assignment
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § EndpointManager
 * Phase 2b: Week 1 deliverable
 */

import { useState } from 'react'
import type { JsonSchema, SchemaProperty } from '@/types/apiCatalog'
import { Card } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { generateExampleData } from '@/utils/formGenerator'

interface PayloadMapperProps {
  schema?: JsonSchema
  onChange?: (schema: JsonSchema) => void
  schemaType?: 'request' | 'response'
}

export function PayloadMapper({
  schema,
  onChange,
  schemaType = 'request',
}: PayloadMapperProps) {
  const [properties, setProperties] = useState<Record<string, SchemaProperty>>(
    schema?.properties || {}
  )
  const [required, setRequired] = useState<string[]>(schema?.required || [])
  const [newFieldName, setNewFieldName] = useState('')
  const [showExample, setShowExample] = useState(false)

  const updateSchema = (
    newProps: Record<string, SchemaProperty>,
    newRequired: string[]
  ) => {
    setProperties(newProps)
    setRequired(newRequired)
    onChange?.({
      type: 'object',
      properties: newProps,
      required: newRequired,
      additionalProperties: false,
    })
  }

  const addField = () => {
    if (!newFieldName.trim() || properties[newFieldName]) return

    const newProp: SchemaProperty = {
      type: 'string',
      description: '',
    }

    updateSchema({ ...properties, [newFieldName]: newProp }, required)
    setNewFieldName('')
  }

  const removeField = (fieldName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [fieldName]: _removed, ...rest } = properties
    updateSchema(rest, required.filter((r) => r !== fieldName))
  }

  const updateField = (
    fieldName: string,
    updates: Partial<SchemaProperty>
  ) => {
    updateSchema(
      {
        ...properties,
        [fieldName]: { ...properties[fieldName], ...updates },
      },
      required
    )
  }

  const toggleRequired = (fieldName: string) => {
    if (required.includes(fieldName)) {
      updateSchema(properties, required.filter((r) => r !== fieldName))
    } else {
      updateSchema(properties, [...required, fieldName])
    }
  }

  const fieldNames = Object.keys(properties)
  const exampleData = showExample
    ? generateExampleData({ type: 'object', properties, required })
    : null

  return (
    <div className="space-y-4">
      {/* Schema Type Header */}
      <Card>
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {schemaType === 'request' ? 'Request' : 'Response'} Schema
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Define the structure and data types for the {schemaType} payload
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExample(!showExample)}
          >
            {showExample ? 'Hide' : 'Show'} Example
          </Button>
        </div>
      </Card>

      {/* Field List */}
      <Card>
        <div className="p-4">
          {fieldNames.length === 0 ? (
            <div className="text-center py-8">
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
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                No fields defined yet. Add one below to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fieldNames.map((fieldName) => {
                const field = properties[fieldName]
                const isRequired = required.includes(fieldName)

                return (
                  <div
                    key={fieldName}
                    className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg space-y-3"
                  >
                    {/* Field Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400">
                          {fieldName}
                        </code>
                        {isRequired && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeField(fieldName)}
                        className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Remove field"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Field Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Type */}
                      <div>
                        <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                          Type
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(fieldName, {
                              type: e.target.value as SchemaProperty['type'],
                            })
                          }
                          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="integer">Integer</option>
                          <option value="boolean">Boolean</option>
                          <option value="array">Array</option>
                          <option value="object">Object</option>
                        </select>
                      </div>

                      {/* Required Toggle */}
                      <div className="flex items-end">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isRequired}
                            onChange={() => toggleRequired(fieldName)}
                            className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                          />
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            Required field
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={field.description || ''}
                        onChange={(e) =>
                          updateField(fieldName, { description: e.target.value })
                        }
                        placeholder="Brief description of this field"
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>

                    {/* Additional constraints */}
                    {field.type === 'string' && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          id={`${fieldName}-minLength`}
                          type="number"
                          label="Min Length"
                          value={field.minLength || ''}
                          onChange={(e) =>
                            updateField(fieldName, {
                              minLength: parseInt(e.target.value) || undefined,
                            })
                          }
                        />
                        <Input
                          id={`${fieldName}-maxLength`}
                          type="number"
                          label="Max Length"
                          value={field.maxLength || ''}
                          onChange={(e) =>
                            updateField(fieldName, {
                              maxLength: parseInt(e.target.value) || undefined,
                            })
                          }
                        />
                      </div>
                    )}

                    {(field.type === 'number' || field.type === 'integer') && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          id={`${fieldName}-min`}
                          type="number"
                          label="Minimum"
                          value={field.minimum || ''}
                          onChange={(e) =>
                            updateField(fieldName, {
                              minimum: parseFloat(e.target.value) || undefined,
                            })
                          }
                        />
                        <Input
                          id={`${fieldName}-max`}
                          type="number"
                          label="Maximum"
                          value={field.maximum || ''}
                          onChange={(e) =>
                            updateField(fieldName, {
                              maximum: parseFloat(e.target.value) || undefined,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Add New Field */}
      <Card>
        <div className="p-4">
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            Add Field
          </h4>
          <div className="flex items-center space-x-2">
            <Input
              id="new-field"
              placeholder="fieldName"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addField()
                }
              }}
            />
            <Button onClick={addField} variant="primary">
              Add Field
            </Button>
          </div>
        </div>
      </Card>

      {/* Example Data */}
      {showExample && exampleData && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Example {schemaType === 'request' ? 'Request' : 'Response'}
              </h4>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(JSON.stringify(exampleData, null, 2))
                }
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Copy
              </button>
            </div>
            <pre className="p-3 bg-neutral-900 dark:bg-black rounded-lg text-sm font-mono text-green-400 overflow-x-auto">
              {JSON.stringify(exampleData, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <div className="p-4">
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            Quick Actions
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const template = {
                  id: { type: 'string' as const, description: 'Unique identifier' },
                  name: { type: 'string' as const, description: 'Name' },
                  createdAt: { type: 'string' as const, description: 'ISO timestamp' },
                }
                updateSchema(template, ['id', 'name'])
              }}
            >
              Load Basic Template
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateSchema({}, [])}
            >
              Clear All
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default PayloadMapper
