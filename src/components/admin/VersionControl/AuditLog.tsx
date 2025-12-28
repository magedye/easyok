/**
 * AuditLog.tsx
 * Searchable, filterable audit log of all catalog changes
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § VersionControl
 * Phase 2b: Week 3 deliverable
 */

import React, { useMemo, useState } from 'react';
import clsx from 'classnames';
import { Card } from '@/components/shared/Card';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuditLogs } from '@/hooks/useAdmin';
import { formatDateTime } from '@/utils/helpers';
import type { PaginationParams } from '@/types';

type AuditLogFilters = PaginationParams & {
  search?: string;
  status?: 'success' | 'failure';
};

export function AuditLog() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [appliedFilters, setAppliedFilters] = useState<{ search?: string; status?: 'success' | 'failure' }>({});

  const queryParams = useMemo<AuditLogFilters>(() => {
    const params: AuditLogFilters = {
      page: currentPage,
      limit: 10,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    };

    if (appliedFilters.search) params.search = appliedFilters.search;
    if (appliedFilters.status) params.status = appliedFilters.status;

    return params;
  }, [appliedFilters.search, appliedFilters.status, currentPage]);

  const { data, isLoading, error, isFetching } = useAuditLogs(queryParams);
  const logs = data?.items ?? [];
  const pageSize = queryParams.limit ?? 10;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  const applyFilters = () => {
    setAppliedFilters({
      search: searchInput || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) =>
    status === 'success'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Audit Log: Catalog Changes</h2>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Search by user, action, or resource..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="md:w-1/2"
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'success' ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter('success')}
            >
              Success
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'failure' ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter('failure')}
            >
              Failure
            </Button>
          </div>

          <Button onClick={applyFilters} isLoading={isFetching} size="sm">
            Apply Filters
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-right">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 dark:bg-neutral-800">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Resource</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={5} className="px-6 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-red-600 dark:text-red-300">
                    Failed to load logs: {String(error)}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-neutral-500">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-200">{log.userId}</td>
                    <td className="px-6 py-4 text-sm font-mono text-neutral-800 dark:text-neutral-100">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                      {log.resource || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          'px-2.5 py-0.5 rounded-full text-xs font-medium',
                          getStatusColor(log.status),
                        )}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || isFetching}
            >
              Previous
            </Button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || isFetching}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default AuditLog;
