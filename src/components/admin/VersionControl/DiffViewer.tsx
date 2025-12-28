/**
 * DiffViewer.tsx
 * Visual diff viewer for catalog versions (Listing major changes)
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § VersionControl
 * Phase 2b: Week 3 deliverable
 */

import React, { useMemo } from 'react';
import type { ApiCatalogVersion, ApiEndpoint, ApiConnection } from '@/types/apiCatalog';
import { Card } from '@/components/shared/Card';
import clsx from 'classnames';

interface DiffViewerProps {
  from: ApiCatalogVersion;
  to: ApiCatalogVersion;
}

// Helper to check for basic structural changes in non-schema properties (using stringify for schemas)
const arePropsDifferent = (obj1: Record<string, any>, obj2: Record<string, any>) => {
  const keys1 = Object.keys(obj1).filter(k => k !== 'requestSchema' && k !== 'responseSchema');
  const keys2 = Object.keys(obj2).filter(k => k !== 'requestSchema' && k !== 'responseSchema');

  if (keys1.length !== keys2.length) return true;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return true;
    }
  }

  // Deep check for Schemas only if they exist
  if (JSON.stringify(obj1.requestSchema) !== JSON.stringify(obj2.requestSchema)) return true;
  if (JSON.stringify(obj1.responseSchema) !== JSON.stringify(obj2.responseSchema)) return true;

  return false;
};

export function DiffViewer({ from, to }: DiffViewerProps) {
  const diff = useMemo(() => {
    const fromEndpoints = new Map(from.endpoints.map(e => [e.id, e]));
    const toEndpoints = new Map(to.endpoints.map(e => [e.id, e]));
    const fromConnections = new Map(from.connections?.map(c => [c.id, c]) || []);
    const toConnections = new Map(to.connections?.map(c => [c.id, c]) || []);

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // Check Endpoints
    for (const id of toEndpoints.keys()) {
      if (!fromEndpoints.has(id)) {
        added.push(`Endpoint: ${toEndpoints.get(id)?.name} (${id})`);
      } else if (arePropsDifferent(toEndpoints.get(id) as ApiEndpoint, fromEndpoints.get(id) as ApiEndpoint)) {
        modified.push(`Endpoint: ${toEndpoints.get(id)?.name} (${id})`);
      }
    }
    for (const id of fromEndpoints.keys()) {
      if (!toEndpoints.has(id)) {
        deleted.push(`Endpoint: ${fromEndpoints.get(id)?.name} (${id})`);
      }
    }

    // Check Connections
    for (const id of toConnections.keys()) {
      if (!fromConnections.has(id)) {
        added.push(`Connection: ${toConnections.get(id)?.name} (${id})`);
      } else if (arePropsDifferent(toConnections.get(id) as ApiConnection, fromConnections.get(id) as ApiConnection)) {
        modified.push(`Connection: ${toConnections.get(id)?.name} (${id})`);
      }
    }
    for (const id of fromConnections.keys()) {
      if (!toConnections.has(id)) {
        deleted.push(`Connection: ${fromConnections.get(id)?.name} (${id})`);
      }
    }

    return { added, modified, deleted };
  }, [from, to]);

  const totalChanges = diff.added.length + diff.modified.length + diff.deleted.length;

  return (
    <Card title={`Version Comparison: ${from.versionNumber} vs ${to.versionNumber}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Added */}
        <div className={clsx("p-4 rounded-lg", diff.added.length > 0 ? "bg-green-50 dark:bg-green-900/30 border border-green-200" : "bg-neutral-50 dark:bg-neutral-800")}>
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-3">
            ➕ Added ({diff.added.length})
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {diff.added.map((item, index) => <li key={index} className="text-green-800 dark:text-green-300">{item}</li>)}
            {diff.added.length === 0 && <li className="text-neutral-500 italic">No additions.</li>}
          </ul>
        </div>

        {/* Modified */}
        <div className={clsx("p-4 rounded-lg", diff.modified.length > 0 ? "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200" : "bg-neutral-50 dark:bg-neutral-800")}>
          <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">
            ✏️ Modified ({diff.modified.length})
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {diff.modified.map((item, index) => <li key={index} className="text-yellow-800 dark:text-yellow-300">{item}</li>)}
            {diff.modified.length === 0 && <li className="text-neutral-500 italic">No modifications.</li>}
          </ul>
        </div>

        {/* Deleted */}
        <div className={clsx("p-4 rounded-lg", diff.deleted.length > 0 ? "bg-red-50 dark:bg-red-900/30 border border-red-200" : "bg-neutral-50 dark:bg-neutral-800")}>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">
            ❌ Deleted ({diff.deleted.length})
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {diff.deleted.map((item, index) => <li key={index} className="text-red-800 dark:text-red-300">{item}</li>)}
            {diff.deleted.length === 0 && <li className="text-neutral-500 italic">No deletions.</li>}
          </ul>
        </div>
      </div>
      
      {totalChanges > 0 && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400 font-medium">
          Total changes detected: {totalChanges} resources.
        </p>
      )}
    </Card>
  );
}

export default DiffViewer;
