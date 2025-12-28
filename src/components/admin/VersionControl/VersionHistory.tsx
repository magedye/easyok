/**
 * VersionHistory.tsx
 * Timeline view of catalog versions with filtering
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § VersionControl
 * Phase 2: Week 4 deliverable
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { useCatalogVersions } from '@/hooks/useApiCatalog';
import VersionTimeline from './VersionTimeline';
import DiffViewer from './DiffViewer';
import PublishWorkflow from './PublishWorkflow';
import { Modal } from '@/components/shared/Modal';
import type { ApiCatalogVersion } from '@/types/apiCatalog';

export function VersionHistory() {
  const { versions, isLoading, error, refetch } = useCatalogVersions();
  const sortedVersions = useMemo(
    () =>
      [...versions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [versions],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);

  const selectedVersion =
    sortedVersions.find((version) => version.id === selectedId) || sortedVersions[0];

  useEffect(() => {
    if (!selectedId && sortedVersions.length > 0) {
      setSelectedId(sortedVersions[0].id);
    }
  }, [selectedId, sortedVersions]);

  useEffect(() => {
    if (selectedVersion) {
      const fallbackCompare = sortedVersions.find((v) => v.id !== selectedVersion.id);
      setCompareId(fallbackCompare?.id || null);
    }
  }, [selectedVersion, sortedVersions]);

  const compareVersion = sortedVersions.find((version) => version.id === compareId);

  const renderVersionDetails = (version: ApiCatalogVersion) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-sm text-neutral-500">Status</p>
        <p className="font-semibold capitalize text-neutral-900 dark:text-white">{version.status}</p>
      </div>
      <div>
        <p className="text-sm text-neutral-500">Created</p>
        <p className="text-neutral-800 dark:text-neutral-200">
          {new Date(version.createdAt).toLocaleString()} by {version.createdBy}
        </p>
      </div>
      <div>
        <p className="text-sm text-neutral-500">Endpoints</p>
        <p className="font-mono text-neutral-900 dark:text-white">{version.endpoints.length}</p>
      </div>
      <div>
        <p className="text-sm text-neutral-500">Connections</p>
        <p className="font-mono text-neutral-900 dark:text-white">
          {version.connections?.length ?? 0}
        </p>
      </div>
      <div className="sm:col-span-2">
        <p className="text-sm text-neutral-500">Description</p>
        <p className="text-neutral-800 dark:text-neutral-200">
          {version.description || 'No description provided.'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card
        title="Version History"
        description="Browse all catalog versions and inspect their differences."
        action={
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      >
        <VersionTimeline
          versions={sortedVersions}
          selectedId={selectedVersion?.id}
          onSelect={(version) => setSelectedId(version.id)}
          isLoading={isLoading}
          error={error}
        />
      </Card>

      {selectedVersion && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            title={`Version ${selectedVersion.versionNumber}`}
            description="Metadata and statistics for the selected version."
            action={
              selectedVersion.status === 'draft' && (
                <Button size="sm" onClick={() => setShowPublish(true)}>
                  Publish
                </Button>
              )
            }
          >
            {renderVersionDetails(selectedVersion)}
          </Card>

          <Card
            title="Compare against"
            description="Select another version to view a diff."
            className="lg:col-span-2"
          >
            {sortedVersions.length <= 1 ? (
              <p className="text-sm text-neutral-500">
                No other versions available for comparison yet.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    Baseline version
                  </label>
                  <select
                    value={compareId || ''}
                    onChange={(e) => setCompareId(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    {sortedVersions
                      .filter((version) => version.id !== selectedVersion.id)
                      .map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.versionNumber} • {version.status}
                        </option>
                      ))}
                  </select>
                </div>

                {compareVersion ? (
                  <DiffViewer from={compareVersion} to={selectedVersion} />
                ) : (
                  <p className="text-sm text-neutral-500">
                    Select a baseline version to view changes.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {showPublish && selectedVersion && (
        <Modal isOpen={showPublish} onClose={() => setShowPublish(false)} title="Publish version">
          <PublishWorkflow
            version={selectedVersion}
            onComplete={() => {
              setShowPublish(false);
              refetch();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default VersionHistory;
