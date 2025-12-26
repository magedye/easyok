/**
 * EasyData Frontend: Stream Rendering Components
 * Files:
 *   - src/components/StreamRenderer.tsx (main)
 *   - src/components/stream/ (sub-components)
 */

import React, { useMemo } from 'react'
import Chart from 'chart.js/auto'
import { useRef, useEffect } from 'react'
import type { StreamState, TechnicalViewPayload, DataPayload, ChartPayload, SummaryPayload } from '@/types/streaming'

// ============================================================================
// MAIN RENDERER COMPONENT
// ============================================================================

interface StreamRendererProps {
  state: StreamState
  isStreaming: boolean
  error: Error | null
  onRetry?: () => void
  isRtl?: boolean
}

/**
 * Top-level component that renders all 4 chunk types
 * Handles type-based routing and RTL layout
 */
export const StreamRenderer: React.FC<StreamRendererProps> = ({
  state,
  isStreaming,
  error,
  onRetry,
  isRtl = false,
}) => {
  const dir = isRtl ? 'rtl' : 'ltr'

  return (
    <div dir={dir} className={`space-y-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Loading Indicator */}
      {isStreaming && <LoadingSpinner label="Processing stream..." />}

      {/* Error Display (takes precedence) */}
      {error && <ErrorAlert error={error} onRetry={onRetry} isRtl={isRtl} />}

      {/* Technical View (SQL, execution plan) */}
      {state.technicalView && !error && (
        <TechnicalView data={state.technicalView} isRtl={isRtl} />
      )}

      {/* Data Table (accumulated rows) */}
      {state.dataRows.length > 0 && !error && (
        <DataTable
          rows={state.dataRows}
          columns={state.columns}
          isRtl={isRtl}
          isLoading={isStreaming}
        />
      )}

      {/* Chart (if included in response) */}
      {state.chartConfig && !error && (
        <ChartContainer config={state.chartConfig} isRtl={isRtl} />
      )}

      {/* Summary (final text summary) */}
      {state.summary && !error && <Summary data={state.summary} isRtl={isRtl} />}

      {/* Debug: Show chunk count */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500">
          Total chunks received: {state.totalChunksReceived}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT 1: TECHNICAL VIEW
// ============================================================================

interface TechnicalViewProps {
  data: TechnicalViewPayload
  isRtl?: boolean
}

export const TechnicalView: React.FC<TechnicalViewProps> = ({
  data,
  isRtl = false,
}) => {
  return (
    <div
      className={`p-4 bg-blue-50 border border-blue-200 rounded-lg ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <h3 className="text-lg font-semibold text-blue-900 mb-2">
        {isRtl ? 'عرض تقني' : 'Technical View'}
      </h3>

      {/* SQL */}
      {data.sql && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            {isRtl ? 'استعلام SQL' : 'SQL Query'}
          </h4>
          <pre className="bg-blue-100 p-3 rounded text-xs overflow-auto max-h-48 font-mono">
            {data.sql}
          </pre>
        </div>
      )}

      {/* Execution Plan */}
      {data.executionPlan && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            {isRtl ? 'خطة التنفيذ' : 'Execution Plan'}
          </h4>
          <pre className="bg-blue-100 p-3 rounded text-xs overflow-auto max-h-48 font-mono">
            {data.executionPlan}
          </pre>
        </div>
      )}

      {/* Metadata */}
      {(data.confidence !== undefined || data.warnings?.length) && (
        <div className="text-sm text-blue-700">
          {data.confidence !== undefined && (
            <p>
              {isRtl ? 'الثقة' : 'Confidence'}: {(data.confidence * 100).toFixed(1)}%
            </p>
          )}
          {data.warnings?.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">{isRtl ? 'تحذيرات' : 'Warnings'}:</p>
              <ul className="list-disc list-inside">
                {data.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT 2: DATA TABLE
// ============================================================================

interface DataTableProps {
  rows: Record<string, unknown>[]
  columns: string[]
  isRtl?: boolean
  isLoading?: boolean
  maxRows?: number
}

export const DataTable: React.FC<DataTableProps> = ({
  rows,
  columns,
  isRtl = false,
  isLoading = false,
  maxRows = 100,
}) => {
  const displayRows = useMemo(() => rows.slice(0, maxRows), [rows, maxRows])
  const actualColumns = useMemo(
    () => (columns.length > 0 ? columns : Object.keys(rows[0] || {})),
    [columns, rows],
  )

  return (
    <div
      className={`p-4 bg-white border border-gray-200 rounded-lg overflow-auto ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <h3 className="text-lg font-semibold mb-4">
        {isRtl ? 'النتائج' : 'Results'} ({displayRows.length})
      </h3>

      {displayRows.length === 0 ? (
        <p className="text-gray-500">{isRtl ? 'لا توجد نتائج' : 'No results'}</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              {actualColumns.map((col) => (
                <th
                  key={col}
                  className={`px-4 py-2 font-semibold ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                {actualColumns.map((col) => (
                  <td
                    key={`${idx}-${col}`}
                    className={`px-4 py-2 ${isRtl ? 'text-right' : 'text-left'}`}
                  >
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isLoading && (
        <p className="text-xs text-gray-500 mt-2">
          {isRtl ? 'جاري استقبال النتائج...' : 'Receiving results...'}
        </p>
      )}

      {rows.length > maxRows && (
        <p className="text-xs text-amber-600 mt-2">
          {isRtl
            ? `عرض ${maxRows} من ${rows.length} صفوف`
            : `Showing ${maxRows} of ${rows.length} rows`}
        </p>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT 3: CHART CONTAINER
// ============================================================================

interface ChartContainerProps {
  config: ChartPayload
  isRtl?: boolean
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  config,
  isRtl = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Destroy previous chart instance
    if (chartRef.current) {
      chartRef.current.destroy()
    }

    // Apply RTL adjustments if needed
    const chartOptions = {
      ...config.options,
      plugins: {
        ...(config.options?.plugins || {}),
        ...(isRtl && { rtl: true }),
      },
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: config.type as any,
      data: {
        labels: config.labels,
        datasets: config.datasets,
      },
      options: chartOptions as any,
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [config, isRtl])

  return (
    <div
      className={`p-4 bg-white border border-gray-200 rounded-lg ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <h3 className="text-lg font-semibold mb-4">
        {isRtl ? 'الرسم البياني' : 'Chart'}
      </h3>
      <div className="relative h-96">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT 4: SUMMARY
// ============================================================================

interface SummaryProps {
  data: SummaryPayload
  isRtl?: boolean
}

export const Summary: React.FC<SummaryProps> = ({ data, isRtl = false }) => {
  return (
    <div
      className={`p-4 bg-green-50 border border-green-200 rounded-lg ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <h3 className="text-lg font-semibold text-green-900 mb-2">
        {isRtl ? 'الملخص' : 'Summary'}
      </h3>
      <p className="text-green-800 text-base">{data.text}</p>

      {data.metrics && (
        <div className="mt-4 text-sm text-green-700 space-y-1">
          {data.metrics.totalRows !== undefined && (
            <p>
              {isRtl ? 'إجمالي الصفوف' : 'Total Rows'}: {data.metrics.totalRows}
            </p>
          )}
          {data.metrics.executionTimeMs !== undefined && (
            <p>
              {isRtl ? 'وقت التنفيذ' : 'Execution Time'}: {data.metrics.executionTimeMs}
              ms
            </p>
          )}
          {data.metrics.queriesCount !== undefined && (
            <p>
              {isRtl ? 'عدد الاستعلامات' : 'Queries'}: {data.metrics.queriesCount}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT 5: ERROR ALERT
// ============================================================================

interface ErrorAlertProps {
  error: Error
  onRetry?: () => void
  isRtl?: boolean
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onRetry,
  isRtl = false,
}) => {
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <h3 className="text-lg font-semibold text-red-900 mb-2">
        {isRtl ? 'خطأ' : 'Error'}
      </h3>
      <p className="text-red-800 text-base">{error.message}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          {isRtl ? 'إعادة محاولة' : 'Retry'}
        </button>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT 6: LOADING SPINNER
// ============================================================================

interface LoadingSpinnerProps {
  label?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
}) => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
      <span className="text-gray-600">{label}</span>
    </div>
  )
}
