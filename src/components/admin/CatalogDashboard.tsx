/**
 * CatalogDashboard.tsx
 * Main admin interface entry point for API Catalog management
 * 
 * Phase 2 Implementation:
 * - Displays overview of endpoints, connections, versions
 * - Provides navigation to each management area
 * - Shows sync status and recent activity
 */

import React from 'react';
import { useApiCatalog } from '@/hooks/useApiCatalog';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { SkeletonStat } from '@/components/loading/SkeletonCard';
import EndpointList from './EndpointManager/EndpointList';
import EndpointEditor from './EndpointManager/EndpointEditor';
import ConnectionList from './ConnectionManager/ConnectionList';
import ConnectionEditor from './ConnectionManager/ConnectionEditor';
import { useApiEndpoints, useApiConnections } from '@/hooks/useApiCatalog';
import ImportDialog from './Shared/ImportDialog';
import ConfigExport from './Shared/ConfigExport';
import TestConnection from './Shared/TestConnection';
import SchemaValidator from './Shared/SchemaValidator';
import type { ApiConnection, ApiEndpoint } from '@/types/apiCatalog';

const StatCard = ({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) => (
  <Card className={`border-l-4 ${accent || 'border-l-neutral-200'}`}>
    <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
    <p className="mt-2 text-3xl font-bold text-neutral-900 dark:text-white">{value}</p>
    {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{hint}</p>}
  </Card>
);

export function CatalogDashboard() {
  const { catalog, isLoading, error, refetch } = useApiCatalog();
  const user = useAuthStore((s) => s.user);
  const { endpoints, create: createEndpoint, update: updateEndpoint, delete: deleteEndpoint } =
    useApiEndpoints();
  const {
    connections,
    create: createConnection,
    update: updateConnection,
    delete: deleteConnection,
    test,
  } = useApiConnections();

  const [section, setSection] = React.useState<'overview' | 'endpoints' | 'connections'>('overview');
  const [showEndpointEditor, setShowEndpointEditor] = React.useState(false);
  const [editingEndpoint, setEditingEndpoint] = React.useState<ApiEndpoint | undefined>(undefined);
  const [showConnectionEditor, setShowConnectionEditor] = React.useState(false);
  const [editingConnection, setEditingConnection] = React.useState<ApiConnection | undefined>(undefined);

  if (user?.role !== 'admin') {
    return (
      <Card className="border-l-4 border-l-red-500">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Access denied</h2>
        <p className="text-neutral-600 dark:text-neutral-300">
          You need the admin role to manage the API Catalog.
        </p>
      </Card>
    );
  }

  const version = catalog.currentVersion;
  const stats = [
    {
      label: 'Endpoints',
      value: version?.endpoints?.length ?? endpoints?.length ?? 0,
      hint: 'Defined in the current catalog version',
      accent: 'border-l-brand-500',
    },
    {
      label: 'Connections',
      value: version?.connections?.length ?? connections?.length ?? 0,
      hint: 'Available data sources',
      accent: 'border-l-accent-500',
    },
    {
      label: 'Active Version',
      value: version?.versionNumber ?? 'n/a',
      hint: version?.status ? `Status: ${version.status}` : 'No version info',
      accent: 'border-l-purple-500',
    },
    {
      label: 'Last Updated',
      value: catalog.updatedAt ? new Date(catalog.updatedAt).toLocaleDateString() : 'Unknown',
      hint: catalog.updatedBy ? `By ${catalog.updatedBy}` : undefined,
      accent: 'border-l-emerald-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            {catalog.name || 'API Catalog'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Manage endpoints, connections, and version lifecycle
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <ImportDialog />
          <ConfigExport />
          <Button variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-l-4 border-l-red-500">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Sync issue</h3>
              <p className="text-sm text-red-600 dark:text-red-200">
                {typeof error === 'string' ? error : 'Failed to load catalog data.'}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? [1, 2, 3, 4].map((key) => <SkeletonStat key={key} />)
          : stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                hint={stat.hint}
                accent={stat.accent}
              />
            ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['overview', 'endpoints', 'connections'] as const).map((key) => (
          <Button
            key={key}
            variant={section === key ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSection(key)}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </Button>
        ))}
      </div>

      {section === 'overview' && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              title="Catalog Overview"
              description="Details of the active catalog version and quick actions."
              className="lg:col-span-2"
            >
              {version ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-500">Version</p>
                    <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                      {version.versionNumber}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      {version.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-500">Status</p>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium capitalize text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                      {version.status}
                    </span>
                    <p className="text-xs text-neutral-500">
                      Created {new Date(version.createdAt).toLocaleString()} by {version.createdBy}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
                      Endpoints
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      {version.endpoints.length} registered endpoints across {catalog.baseUrls.length}{' '}
                      environments.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
                      Connections
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      {version.connections?.length ?? 0} configured upstream services.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">No catalog version available.</p>
              )}
            </Card>

            <SchemaValidator />
          </div>

          <TestConnection />
        </>
      )}

      {section === 'endpoints' && (
        <>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setEditingEndpoint(undefined);
                setShowEndpointEditor(true);
              }}
            >
              + New Endpoint
            </Button>
          </div>
          <EndpointList
            onEdit={(ep) => {
              setEditingEndpoint(ep);
              setShowEndpointEditor(true);
            }}
            onDelete={(ep) => {
              if (window.confirm(`Delete endpoint ${ep.name}?`)) {
                void deleteEndpoint.mutateAsync(ep.id);
              }
            }}
            onCreate={() => {
              setEditingEndpoint(undefined);
              setShowEndpointEditor(true);
            }}
            onTest={(ep) => console.log('Test endpoint', ep.id)}
          />
        </>
      )}

      {section === 'connections' && (
        <>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setEditingConnection(undefined);
                setShowConnectionEditor(true);
              }}
            >
              + New Connection
            </Button>
          </div>
          <ConnectionList
            onEdit={(conn) => {
              setEditingConnection(conn);
              setShowConnectionEditor(true);
            }}
            onDelete={(conn) => {
              if (window.confirm(`Delete connection ${conn.name}?`)) {
                void deleteConnection.mutateAsync(conn.id);
              }
            }}
            onTest={(conn) => test.mutateAsync(conn.id)}
            onCreate={() => {
              setEditingConnection(undefined);
              setShowConnectionEditor(true);
            }}
          />
        </>
      )}

      <EndpointEditor
        isOpen={showEndpointEditor}
        endpoint={editingEndpoint}
        onClose={() => setShowEndpointEditor(false)}
        onSave={async (data) => {
          if (editingEndpoint) {
            await updateEndpoint.mutateAsync({ id: editingEndpoint.id, ...data });
          } else {
            await createEndpoint.mutateAsync(data as ApiEndpoint);
          }
        }}
        isSubmitting={createEndpoint.isPending || updateEndpoint.isPending}
      />

      <ConnectionEditor
        isOpen={showConnectionEditor}
        connection={editingConnection}
        onClose={() => setShowConnectionEditor(false)}
        onSave={async (data) => {
          if (editingConnection) {
            await updateConnection.mutateAsync({ id: editingConnection.id, ...data });
          } else {
            await createConnection.mutateAsync(data as ApiConnection);
          }
        }}
        isSubmitting={createConnection.isPending || updateConnection.isPending}
      />
    </div>
  );
}

export default CatalogDashboard;
