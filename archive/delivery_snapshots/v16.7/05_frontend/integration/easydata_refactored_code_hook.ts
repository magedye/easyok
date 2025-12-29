/**
 * EasyData Frontend: Custom Streaming Hook
 * File: src/hooks/useEasyStream.ts
 */

import { useState, useCallback, useRef } from 'react'
import {
  ndjsonStream,
  isDataChunk,
  isTechnicalViewChunk,
  isChartChunk,
  isSummaryChunk,
  isErrorChunk,
} from '@/utils/ndjsonParser'
import type { StreamState, UseEasyStreamResult, StreamChunk } from '@/types/streaming'

/**
 * Custom hook for consuming NDJSON streaming endpoints
 *
 * Usage:
 *   const { state, isStreaming, error, abort, reset } = useEasyStream()
 *
 *   const handleSubmit = async (question: string) => {
 *     const reader = await streamingFetch('/ask', {
 *       method: 'POST',
 *       body: JSON.stringify({ question }),
 *     })
 *
 *     // Process stream (refactor useEasyStream to expose startStreaming)
 *     for await (const chunk of ndjsonStream(reader)) {
 *       // State updates via processChunk
 *     }
 *   }
 */
export function useEasyStream(): UseEasyStreamResult {
  const [state, setState] = useState<StreamState>({
    dataRows: [],
    columns: [],
    isLoading: false,
    totalChunksReceived: 0,
  })

  const [error, setError] = useState<Error | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  /**
   * Process a single chunk and update state
   * This is called for each chunk from ndjsonStream
   */
  const processChunk = useCallback((chunk: StreamChunk) => {
    setState((prev) => {
      const updated = { ...prev, totalChunksReceived: prev.totalChunksReceived + 1 }

      if (isTechnicalViewChunk(chunk)) {
        updated.technicalView = chunk.payload
      } else if (isDataChunk(chunk)) {
        // Accumulate rows from data chunks
        const newRows = chunk.payload.rows || []
        updated.dataRows = [...prev.dataRows, ...newRows]

        // Capture columns from first data chunk (or override if provided)
        if (chunk.payload.columns && !prev.columns.length) {
          updated.columns = chunk.payload.columns
        }
      } else if (isChartChunk(chunk)) {
        updated.chartConfig = chunk.payload
      } else if (isSummaryChunk(chunk)) {
        updated.summary = chunk.payload
      }

      return updated
    })
  }, [])

  /**
   * Start processing chunks from a ReadableStream reader
   * Called by the component after fetch succeeds
   */
  const startStreaming = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      readerRef.current = reader
      setIsStreaming(true)
      setError(null)
      setState({
        dataRows: [],
        columns: [],
        isLoading: true,
        totalChunksReceived: 0,
      })

      try {
        for await (const chunk of ndjsonStream(reader)) {
          // Update state based on chunk type
          processChunk(chunk)

          // Check if we hit an error (stops iteration)
          if (isErrorChunk(chunk)) {
            setIsStreaming(false)
            setError(new Error(chunk.payload.message))
            break
          }
        }

        // All chunks processed successfully
        setIsStreaming(false)
        setState((prev) => ({ ...prev, isLoading: false }))
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setIsStreaming(false)
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    },
    [processChunk],
  )

  /**
   * Abort the current stream
   */
  const abort = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  /**
   * Reset state (for new query)
   */
  const reset = useCallback(() => {
    abort()
    setState({
      dataRows: [],
      columns: [],
      isLoading: false,
      totalChunksReceived: 0,
    })
    setError(null)
  }, [abort])

  return {
    state,
    isStreaming,
    error,
    abort,
    reset,
    // Expose startStreaming so components can pass the reader
    _startStreaming: startStreaming,
  } as UseEasyStreamResult & { _startStreaming: typeof startStreaming }
}

/**
 * Alternative: Higher-level hook that combines fetch + streaming in one call
 * Returns execute() function that handles the full flow
 *
 * Usage:
 *   const { state, isStreaming, error, execute } = useEasyStreamWithFetch('/ask')
 *   await execute({ question: 'Top products?' })
 */
export function useEasyStreamWithFetch(endpoint: string) {
  const hook = useEasyStream()
  const { state, isStreaming, error, abort, reset } = hook
  const startStreaming = (hook as any)._startStreaming

  const execute = useCallback(
    async (payload: Record<string, unknown>) => {
      // Dynamically import to avoid circular dependencies
      const { streamingFetch } = await import('@/utils/streamingFetch')

      reset()

      try {
        const reader = await streamingFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        await startStreaming(reader)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        // Error is set via hook
      }
    },
    [endpoint, reset, startStreaming],
  )

  return {
    state,
    isStreaming,
    error,
    abort,
    reset,
    execute,
  }
}
