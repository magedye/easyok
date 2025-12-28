import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { Card } from '@/components/shared/Card'
import { SkeletonStat, SkeletonCard } from '@/components/loading/SkeletonCard'
import { getSystemHealth, getAuditLogs } from '@/services/adminService'
import { systemClient } from '@/services/apiClient'
import { useObservabilitySeries } from '@/hooks/useSystem'

export const ObservabilityPage = () => {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.dir() === 'rtl'

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['audit-logs-observability'],
    queryFn: () => getAuditLogs({ page: 1, limit: 10 }),
    refetchInterval: 15000, // Refresh every 15 seconds
  })

  const { data: prometheusMetrics } = useQuery({
    queryKey: ['prometheus-metrics'],
    queryFn: async () => {
      const { data } = await systemClient.get('/metrics/json')
      return data
    },
    refetchInterval: 30000,
  })

  const {
    metrics,
    requestSeries,
    latencySeries,
    isLoading: metricsLoading,
  } = useObservabilitySeries()

  return (
    <div className={clsx('space-y-6', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          {t('observability.title') || 'System Observability'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          {t('observability.subtitle') || 'Monitor system health, metrics, and activity'}
        </p>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {healthLoading ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <Card className={`border-l-4 ${
              health?.status === 'healthy' 
                ? 'border-l-green-500' 
                : health?.status === 'degraded'
                ? 'border-l-yellow-500'
                : 'border-l-red-500'
            }`}>
              <div>
                <p className="text-sm text-neutral-500">System Status</p>
                <p className={`text-2xl font-bold ${
                  health?.status === 'healthy'
                    ? 'text-green-600'
                    : health?.status === 'degraded'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {health?.status || 'Unknown'}
                </p>
              </div>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <div>
                <p className="text-sm text-neutral-500">Database</p>
                <p className={`text-2xl font-bold ${
                  health?.database === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {health?.database === 'ok' ? '✓ Online' : '✗ Error'}
                </p>
              </div>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <div>
                <p className="text-sm text-neutral-500">Cache</p>
                <p className={`text-2xl font-bold ${
                  health?.cache === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {health?.cache === 'ok' ? '✓ Online' : '✗ Error'}
                </p>
              </div>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <div>
                <p className="text-sm text-neutral-500">Uptime</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {health?.uptime ? `${Math.floor(health.uptime / 3600)}h` : '0h'}
                </p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Performance Metrics */}
      <Card title="Performance Metrics" description="System performance indicators">
        {metricsLoading ? (
          <SkeletonCard />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Avg Query Time</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {metrics?.averageQueryTime?.toFixed(0) || 0}ms
              </p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {metrics?.successRate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Active Queries</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {metrics?.activeQueries || 0}
              </p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Queries/Min</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {metrics?.queriesPerMinute?.toFixed(1) || 0}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Time-series Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Request Volume" description="5-minute buckets over the last hour">
          {metricsLoading ? (
            <SkeletonCard />
          ) : requestSeries.length > 0 ? (
            <RequestVolumeChart data={requestSeries} />
          ) : (
            <p className="text-sm text-neutral-500">No request data available.</p>
          )}
        </Card>

        <Card title="Latency & Error Rate" description="p95 latency with error overlay">
          {metricsLoading ? (
            <SkeletonCard />
          ) : latencySeries.length > 0 ? (
            <LatencyChart data={latencySeries} />
          ) : (
            <p className="text-sm text-neutral-500">No latency data available.</p>
          )}
        </Card>
      </div>

      {/* Prometheus Metrics */}
      {prometheusMetrics && (
        <Card title="Prometheus Metrics" description="Raw metrics from Prometheus endpoint">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">App Name</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                {prometheusMetrics.appInfo?.name || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Version</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                {prometheusMetrics.appInfo?.version || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Service Status</p>
              <p className={`text-lg font-semibold ${
                prometheusMetrics.serviceStatus === 'healthy'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {prometheusMetrics.serviceStatus || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
              <p className="text-sm text-neutral-500 mb-1">Providers Total</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                {prometheusMetrics.providersTotal || 0}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Audit Logs */}
        <Card title="Recent Activity" description="Latest system events">
          {logsLoading ? (
            <SkeletonCard />
          ) : auditLogs?.items && auditLogs.items.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.items.map((log: any) => (
                <div 
                  key={log.id}
                  className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {log.action}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {log.resource} • {log.userId}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No recent activity</p>
          )}
        </Card>

        {/* System Resources */}
        <Card title="System Resources" description="Resource utilization">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  CPU Usage
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {metrics?.cpuUsage?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (metrics?.cpuUsage || 0) > 80 ? 'bg-red-500' :
                    (metrics?.cpuUsage || 0) > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(metrics?.cpuUsage || 0, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Memory Usage
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {metrics?.memoryUsage?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (metrics?.memoryUsage || 0) > 80 ? 'bg-red-500' :
                    (metrics?.memoryUsage || 0) > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(metrics?.memoryUsage || 0, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Disk Usage
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {metrics?.diskUsage?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (metrics?.diskUsage || 0) > 80 ? 'bg-red-500' :
                    (metrics?.diskUsage || 0) > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(metrics?.diskUsage || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Alert Notice */}
      <Card className="border-l-4 border-l-blue-500">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
              Real-time Monitoring
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Metrics are automatically refreshed every 10-30 seconds. Health status updates in real-time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

type VolumePoint = { time: string; count: number }
type LatencyPoint = { time: string; latency: number; errorRate: number }
type ChartTooltipEntry = NonNullable<TooltipContentProps<number, string>['payload']>[number]

const ChartTooltip = ({
  active,
  label,
  payload,
  unit,
}: Partial<TooltipContentProps<number, string>> & { unit?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  const suffix = unit ?? ''
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <p className="font-semibold text-neutral-800 dark:text-neutral-100">{label}</p>
      {payload.map((entry: ChartTooltipEntry) => (
        <p key={entry.dataKey} className="text-neutral-600 dark:text-neutral-300">
          {entry.name}: {entry.value}
          {suffix}
        </p>
      ))}
    </div>
  )
}

const RequestVolumeChart = ({ data }: { data: VolumePoint[] }) => (
  <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip unit=" req" />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#2563eb"
          fillOpacity={1}
          name="Requests"
          fill="url(#volumeGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
)

const LatencyChart = ({ data }: { data: LatencyPoint[] }) => (
  <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="latency"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}ms`}
        />
        <YAxis
          yAxisId="error"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null
            const latency = payload.find((p) => p.dataKey === 'latency')?.value
            const errorRate = payload.find((p) => p.dataKey === 'errorRate')?.value
            return (
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <p className="font-semibold text-neutral-800 dark:text-neutral-100">{label}</p>
                <p className="text-neutral-600 dark:text-neutral-300">Latency: {latency} ms</p>
                <p className="text-neutral-600 dark:text-neutral-300">Error rate: {errorRate}%</p>
              </div>
            )
          }}
        />
        <Line
          yAxisId="latency"
          type="monotone"
          dataKey="latency"
          stroke="#7c3aed"
          strokeWidth={2.5}
          dot={false}
          name="p95 latency"
        />
        <Line
          yAxisId="error"
          type="monotone"
          dataKey="errorRate"
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
          name="Error rate"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)
