import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSystemMetrics } from '@/services/adminService';
import type { SystemMetrics } from '@/types';

/**
 * useObservabilitySeries
 * Separates observability series fetching from UI components.
 *
 * TODO (backend): Replace mocked shape with real time-series payload.
 * Expected payload option A (Prometheus range query):
 * {
 *   results: [
 *     { metric: { __name__: 'request_volume' }, values: [[timestampSeconds, "123"], ...] },
 *     { metric: { __name__: 'latency_p95' }, values: [[ts, "245"], ...] }
 *   ]
 * }
 *
 * Expected payload option B (structured JSON from /admin/metrics/series):
 * {
 *   requestVolumeSeries: [{ timestamp: ISO_STRING, count: number }],
 *   latencyP95Series: [{ timestamp: ISO_STRING, ms: number }],
 *   errorRateSeries: [{ timestamp: ISO_STRING, rate: number }]
 * }
 */
export const useObservabilitySeries = () => {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery<SystemMetrics>({
    queryKey: ['system-metrics'],
    queryFn: getSystemMetrics,
    refetchInterval: 30000,
  });

  const formatTimeLabel = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const requestSeries = useMemo(
    () =>
      metrics?.requestVolumeSeries?.map((point) => ({
        time: formatTimeLabel(point.timestamp),
        count: point.count,
      })) ?? [],
    [metrics?.requestVolumeSeries],
  );

  const latencySeries = useMemo(
    () =>
      metrics?.latencyP95Series?.map((point, index) => ({
        time: formatTimeLabel(point.timestamp),
        latency: point.ms,
        errorRate: metrics?.errorRateSeries?.[index]?.rate ?? 0,
      })) ?? [],
    [metrics?.errorRateSeries, metrics?.latencyP95Series],
  );

  return {
    metrics,
    requestSeries,
    latencySeries,
    isLoading,
    error,
  };
};
