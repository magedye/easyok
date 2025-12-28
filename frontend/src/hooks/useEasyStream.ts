import { useCallback, useRef, useState } from 'react';

import type {
  AskChunk,
  AskQuestionPayload,
  TechnicalViewPayload,
  DataPayload,
  ChartPayload,
  SummaryPayload
} from '../types/api';
import { askQuestion } from '../api/easyStream';

type UseEasyStreamState = {
  technicalView: TechnicalViewPayload | null;
  dataRows: Array<Record<string, unknown>>;
  columns: string[];
  chart: ChartPayload | null;
  summary: SummaryPayload | null;
  isStreaming: boolean;
  error: string | null;
};

export type UseEasyStreamResult = UseEasyStreamState & {
  start: (payload: AskQuestionPayload, onChunk: (chunk: AskChunk) => void) => Promise<void>;
  cancel: () => void;
};

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function useEasyStream(): UseEasyStreamResult {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<UseEasyStreamState>({
    technicalView: null,
    dataRows: [],
    columns: [],
    chart: null,
    summary: null,
    isStreaming: false,
    error: null
  });

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const start = useCallback(
    async (payload: AskQuestionPayload, onChunk: (chunk: AskChunk) => void) => {
      cancel();

      const controller = new AbortController();
      controllerRef.current = controller;

      setState((s) => ({
        ...s,
        isStreaming: true,
        error: null,
        dataRows: [],
        columns: [],
        chart: null,
        summary: null,
        technicalView: null
      }));

      try {
        await askQuestion(
          payload,
          (chunk) => {
            switch (chunk.type) {
              case 'technical_view':
                setState((s) => ({ ...s, technicalView: chunk.payload as TechnicalViewPayload }));
                break;
              case 'data': {
                const payload = chunk.payload as DataPayload;
                if (Array.isArray(payload)) {
                  setState((s) => ({ ...s, dataRows: payload }));
                } else {
                  setState((s) => ({
                    ...s,
                    dataRows: payload.rows || [],
                    columns: payload.columns || s.columns
                  }));
                }
                break;
              }
              case 'chart':
                setState((s) => ({ ...s, chart: chunk.payload as ChartPayload }));
                break;
              case 'summary':
                setState((s) => ({ ...s, summary: chunk.payload as SummaryPayload }));
                break;
              case 'error':
                setState((s) => ({ ...s, error: (chunk.payload as any).message || 'Error' }));
                break;
              default:
                break;
            }
            onChunk(chunk);
          },
          { signal: controller.signal }
        );
      } catch (err: unknown) {
        const isAbortError = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbortError) {
          setState({
            technicalView: null,
            dataRows: [],
            columns: [],
            chart: null,
            summary: null,
            isStreaming: false,
            error: toErrorMessage(err)
          });
          throw err;
        }
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setState((s) => ({ ...s, isStreaming: false }));
      }
    },
    [cancel]
  );

  return {
    ...state,
    start,
    cancel
  };
}
