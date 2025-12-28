import { useCallback, useEffect, useState } from 'react';

import type { SummaryPayload, TechnicalViewPayload } from '../types/api';

export type RunHistoryEntry = {
  id: string;
  question: string;
  technicalView: TechnicalViewPayload | null;
  summary: SummaryPayload | null;
  timestamp: number;
  status: 'success' | 'failed';
};

const STORAGE_KEY = 'easydata-run-history';

function load(): RunHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RunHistoryEntry[];
  } catch {
    return [];
  }
}

function persist(entries: RunHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    // ignore
  }
}

export function useRunHistory() {
  const [entries, setEntries] = useState<RunHistoryEntry[]>(() => load());

  useEffect(() => {
    persist(entries);
  }, [entries]);

  const addEntry = useCallback((entry: RunHistoryEntry) => {
    setEntries((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, addEntry, clear };
}
