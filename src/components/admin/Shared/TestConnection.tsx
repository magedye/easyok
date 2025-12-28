/**
 * TestConnection.tsx
 * Send test request to a catalog endpoint and display results
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2b: Week 4 deliverable
 */

import React, { useMemo } from 'react';
import { Card } from '@/components/shared/Card';
import { useApiCatalog, useApiConnections } from '@/hooks/useApiCatalog';
import type { ApiConnection } from '@/types/apiCatalog';
import HealthCheck, { type HealthCheckDisplayResult } from '@/components/admin/ConnectionManager/HealthCheck';

interface TestConnectionProps {
  connection?: ApiConnection;
}

export function TestConnection({ connection }: TestConnectionProps) {
  const { catalog, isLoading: catalogLoading } = useApiCatalog();
  const { connections, isLoading: connectionsLoading, test } = useApiConnections();

  const targetConnection = useMemo(() => {
    if (connection) return connection;
    const catalogDefault = catalog.currentVersion?.connections?.find((c) => c.isDefault);
    return catalogDefault || connections.find((c) => c.isDefault) || connections[0];
  }, [catalog.currentVersion?.connections, connection, connections]);

  const onTest = async (connectionId: string): Promise<HealthCheckDisplayResult> => {
    const result = await test.mutateAsync(connectionId);
    const status: HealthCheckDisplayResult['status'] = result.healthy ? 'success' : 'error';
    return {
      status,
      latency: result.responseTime,
      statusCode: result.statusCode,
      message: result.error || 'Connection is healthy',
      timestamp: result.lastCheckedAt,
    };
  };

  if (catalogLoading || connectionsLoading) {
    return (
      <Card title="Test Connection">
        <p className="text-neutral-500">Loading connections...</p>
      </Card>
    );
  }

  if (!targetConnection) {
    return (
      <Card title="Test Connection">
        <p className="text-neutral-500">No connections configured for this catalog.</p>
      </Card>
    );
  }

  return (
    <HealthCheck
      connection={targetConnection}
      onTest={onTest}
    />
  );
}

export default TestConnection;
