import { Suspense, lazy, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { SkeletonStat, SkeletonTable } from '@/components/loading/SkeletonCard';
import { getAdminStats, getAuditLogs, getSystemHealth, refreshSchemaCache } from '@/services/adminService';
import { useToast } from '@/components/shared/Toast';

type AdminTab = 'overview' | 'users' | 'catalog' | 'versions' | 'audit';

const LazyUserManagement = lazy(() => import('@/components/admin/Users/UserManagement'));
const LazyCatalogDashboard = lazy(() => import('@/components/admin/CatalogDashboard'));
const LazyVersionHistory = lazy(() => import('@/components/admin/VersionControl/VersionHistory'));

export const AdminPage = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const tabs = useMemo<AdminTab[]>(() => ['overview', 'users', 'catalog', 'versions', 'audit'], []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => getAuditLogs({ page: 1, limit: 20 }),
  });

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 30000,
  });

  const refreshSchemaMutation = useMutation({
    mutationFn: refreshSchemaCache,
    onSuccess: () => {
      showToast({ title: 'Schema cache refreshed', variant: 'success' });
      setError(null);
    },
    onError: (err: any) => {
      const message = err?.message || 'Failed to refresh schema cache';
      setError(message);
      showToast({ title: 'Refresh failed', description: message, variant: 'error' });
    },
  });

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <Card className="border-l-4 border-l-blue-500">
              <div>
                <p className="text-sm text-neutral-500">Total Users</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats?.totalUsers?.toLocaleString() || 0}
                </p>
              </div>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <div>
                <p className="text-sm text-neutral-500">Active Users</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats?.activeUsers?.toLocaleString() || 0}
                </p>
              </div>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <div>
                <p className="text-sm text-neutral-500">System Health</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {health?.status || 'Unknown'}
                </p>
              </div>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <div>
                <p className="text-sm text-neutral-500">Total Queries</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats?.totalQueries?.toLocaleString() || 0}
                </p>
              </div>
            </Card>
          </>
        )}
      </div>

      {health && (
        <Card title="System Health" className="border-l-4 border-l-green-500">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-neutral-500">Database</p>
              <p
                className={`text-lg font-semibold ${
                  health.database === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {health.database === 'ok' ? '✓ Online' : '✗ Error'}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Cache</p>
              <p
                className={`text-lg font-semibold ${
                  health.cache === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {health.cache === 'ok' ? '✓ Online' : '✗ Error'}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Uptime</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                {Math.floor(health.uptime / 3600)}h
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => refreshSchemaMutation.mutate()}
              disabled={refreshSchemaMutation.isPending}
            >
              {refreshSchemaMutation.isPending ? 'Refreshing...' : 'Refresh Schema Cache'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );

  const renderAudit = () => (
    <Card title="Recent Audit Logs" description="System activity log" className="mt-6">
      {logsLoading ? (
        <SkeletonTable rows={5} />
      ) : auditLogs?.items && auditLogs.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                  Timestamp
                </th>
                <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                  User
                </th>
                <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                  Action
                </th>
                <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                  Resource
                </th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.items.map((log: any) => (
                <tr key={log.id} className="border-t border-neutral-200 dark:border-neutral-700">
                  <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{log.userId}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{log.action}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{log.resource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No audit logs found</p>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          {t('admin.title') || 'Admin Panel'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          {t('admin.subtitle') || 'Manage users, system settings, and monitor activity'}
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2 dark:border-neutral-800"
        role="tablist"
        aria-label="Admin tabs"
        onKeyDown={(e) => {
          const currentIndex = tabs.indexOf(activeTab);
          if (e.key === 'ArrowRight') {
            const next = (currentIndex + 1) % tabs.length;
            setActiveTab(tabs[next]);
            e.preventDefault();
          } else if (e.key === 'ArrowLeft') {
            const prev = (currentIndex - 1 + tabs.length) % tabs.length;
            setActiveTab(tabs[prev]);
            e.preventDefault();
          }
        }}
      >
        {tabs.map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={activeTab === tab ? 'primary' : 'ghost'}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`admin-tabpanel-${tab}`}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'users'
              ? 'User Management'
              : tab === 'catalog'
              ? 'API Catalog'
              : tab === 'versions'
              ? 'Version Control'
              : 'Audit Logs'}
          </Button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md">
          <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
        </div>
      )}

      {activeTab === 'overview' && (
        <div id="admin-tabpanel-overview" role="tabpanel" aria-labelledby="overview">
          {renderOverview()}
        </div>
      )}
      {activeTab === 'users' && (
        <div id="admin-tabpanel-users" role="tabpanel" aria-labelledby="users" className="mt-6">
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <LazyUserManagement />
          </Suspense>
        </div>
      )}
      {activeTab === 'catalog' && (
        <div id="admin-tabpanel-catalog" role="tabpanel" aria-labelledby="catalog" className="mt-6">
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <LazyCatalogDashboard />
          </Suspense>
        </div>
      )}
      {activeTab === 'versions' && (
        <div id="admin-tabpanel-versions" role="tabpanel" aria-labelledby="versions" className="mt-6">
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <LazyVersionHistory />
          </Suspense>
        </div>
      )}
      {activeTab === 'audit' && renderAudit()}
    </div>
  );
};

export default AdminPage;
