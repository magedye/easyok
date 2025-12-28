/**
 * RoutingBuilder.tsx
 * Visual path parameter builder with real-time URL preview
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § EndpointManager
 * Phase 2b: Week 1 deliverable
 */

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/shared/Card'
import { Input } from '@/components/shared/Input'
import { Button } from '@/components/shared/Button'
import clsx from 'classnames'

interface PathSegment {
  id: string
  type: 'static' | 'param'
  value: string
}

interface RoutingBuilderProps {
  initialPath?: string
  baseUrl?: string
  onChange?: (path: string) => void
}

export function RoutingBuilder({
  initialPath = '/',
  baseUrl = 'https://api.example.com',
  onChange,
}: RoutingBuilderProps) {
  const [segments, setSegments] = useState<PathSegment[]>([])
  const [newSegmentValue, setNewSegmentValue] = useState('')
  const [newSegmentType, setNewSegmentType] = useState<'static' | 'param'>('static')

  // Helper functions
  const parsePath = useCallback((path: string): PathSegment[] => {
    const parts = path.split('/').filter(Boolean)
    return parts.map((part, index) => ({
      id: `segment-${index}`,
      type: part.startsWith('{') && part.endsWith('}') ? 'param' : 'static',
      value: part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : part,
    }))
  }, [])

  const buildPathFromSegments = useCallback((segs: PathSegment[]): string => {
    if (segs.length === 0) return '/'
    return (
      '/' +
      segs
        .map((seg) => (seg.type === 'param' ? `{${seg.value}}` : seg.value))
        .join('/')
    )
  }, [])

  // Parse initial path
  useEffect(() => {
    if (initialPath) {
      const parsed = parsePath(initialPath)
      setSegments(parsed)
    }
  }, [initialPath, parsePath])

  // Build path from segments
  const builtPath = buildPathFromSegments(segments)
  const fullUrl = `${baseUrl}${builtPath}`

  // Notify parent of changes
  useEffect(() => {
    onChange?.(builtPath)
  }, [builtPath, onChange])

  const addSegment = () => {
    if (!newSegmentValue.trim()) return

    const newSegment: PathSegment = {
      id: `segment-${Date.now()}`,
      type: newSegmentType,
      value: newSegmentValue.trim(),
    }

    setSegments([...segments, newSegment])
    setNewSegmentValue('')
  }

  const removeSegment = (id: string) => {
    setSegments(segments.filter((seg) => seg.id !== id))
  }

  const updateSegment = (id: string, value: string) => {
    setSegments(
      segments.map((seg) => (seg.id === id ? { ...seg, value } : seg))
    )
  }

  const toggleSegmentType = (id: string) => {
    setSegments(
      segments.map((seg) =>
        seg.id === id
          ? { ...seg, type: seg.type === 'static' ? 'param' : 'static' }
          : seg
      )
    )
  }

  return (
    <div className="space-y-4">
      {/* URL Preview */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
            URL Preview
          </h3>
          <div className="flex items-center space-x-2">
            <code className="flex-1 p-3 bg-neutral-900 dark:bg-black rounded-lg text-sm font-mono text-green-400 break-all">
              {fullUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(fullUrl)}
              className="p-2 text-neutral-400 hover:text-brand-500"
              title="Copy URL"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </Card>

      {/* Path Segments */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
            Path Segments
          </h3>

          {segments.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">
              No segments yet. Add one below to start building your path.
            </p>
          ) : (
            <div className="space-y-2">
              {segments.map((segment, index) => (
                <div
                  key={segment.id}
                  className="flex items-center space-x-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                >
                  {/* Segment Index */}
                  <span className="text-xs text-neutral-400 w-6">
                    {index + 1}.
                  </span>

                  {/* Segment Type Badge */}
                  <button
                    onClick={() => toggleSegmentType(segment.id)}
                    className={clsx(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      segment.type === 'param'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                    title="Click to toggle type"
                  >
                    {segment.type === 'param' ? '{param}' : 'static'}
                  </button>

                  {/* Segment Value */}
                  <input
                    type="text"
                    value={segment.value}
                    onChange={(e) => updateSegment(segment.id, e.target.value)}
                    placeholder={segment.type === 'param' ? 'paramName' : 'path-segment'}
                    className="flex-1 px-3 py-1 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded text-sm"
                  />

                  {/* Preview */}
                  <code className="text-sm font-mono text-neutral-600 dark:text-neutral-400 min-w-[100px]">
                    /{segment.type === 'param' ? `{${segment.value}}` : segment.value}
                  </code>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeSegment(segment.id)}
                    className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Remove segment"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Add Segment */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
            Add Segment
          </h3>
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Input
                id="new-segment"
                placeholder="users or userId"
                value={newSegmentValue}
                onChange={(e) => setNewSegmentValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSegment()
                  }
                }}
              />
            </div>
            <div className="w-32">
              <select
                value={newSegmentType}
                onChange={(e) => setNewSegmentType(e.target.value as 'static' | 'param')}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              >
                <option value="static">Static</option>
                <option value="param">Parameter</option>
              </select>
            </div>
            <Button onClick={addSegment} variant="primary" size="sm">
              Add
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Examples */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-3">
            Common Patterns
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { label: 'List all', path: '/users', description: 'GET collection' },
              { label: 'Get by ID', path: '/users/{id}', description: 'GET single item' },
              { label: 'Nested resource', path: '/users/{userId}/posts', description: 'Nested collection' },
              { label: 'Action', path: '/queries/generate', description: 'POST action' },
            ].map((example) => (
              <button
                key={example.path}
                onClick={() => setSegments(parsePath(example.path))}
                className="text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {example.label}
                  </span>
                  <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <code className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                  {example.path}
                </code>
                <p className="text-xs text-neutral-500 mt-1">{example.description}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default RoutingBuilder
