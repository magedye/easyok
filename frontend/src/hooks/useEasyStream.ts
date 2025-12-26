import { useCallback, useRef, useState } from 'react';

import type { AskChunk, AskQuestionPayload } from '../types/api';
import { askQuestion } from '../api/easyStream';

type UseEasyStreamState = {
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

      setState({ isStreaming: true, error: null });

      try {
        await askQuestion(payload, onChunk, { signal: controller.signal });
      } catch (err: unknown) {
        const isAbortError = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbortError) {
          setState({ isStreaming: false, error: toErrorMessage(err) });
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
