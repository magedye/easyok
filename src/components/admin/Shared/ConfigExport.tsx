/**
 * ConfigExport.tsx
 * Export catalog as JSON or OpenAPI spec
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2b: Week 4 deliverable
 */

import React from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { useApiCatalog, useCatalogImportExport } from '@/hooks/useApiCatalog';
import { useToast } from '@/components/shared/Toast';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export function ConfigExport() {
  const { catalog } = useApiCatalog();
  const { exportOpenApi, exportJson } = useCatalogImportExport();
  const { showToast } = useToast();
  const versionId = catalog.currentVersionId;

  const handleExportOpenApi = (asJson: boolean) => {
    exportOpenApi.mutate(versionId, {
      onSuccess: async (blob) => {
        if (asJson) {
          try {
            const rawText = await blob.text();
            const yaml = await import('js-yaml');
            const parsed = yaml.load(rawText);
            const jsonBlob = new Blob([JSON.stringify(parsed, null, 2)], {
              type: 'application/json',
            });
            downloadBlob(jsonBlob, `catalog-${versionId || 'latest'}.openapi.json`);
          } catch (err) {
            showToast({
              title: 'Export failed',
              description: 'Could not convert OpenAPI to JSON.',
              variant: 'error',
            });
          }
        } else {
          downloadBlob(blob, `catalog-${versionId || 'latest'}.openapi.yaml`);
        }
      },
      onError: (err) =>
        showToast({
          title: 'Export failed',
          description: err instanceof Error ? err.message : 'Unable to export OpenAPI spec',
          variant: 'error',
        }),
    });
  };

  const handleExportJson = () => {
    exportJson.mutate(versionId, {
      onSuccess: (blob) => downloadBlob(blob, `catalog-${versionId || 'latest'}.json`),
      onError: (err) =>
        showToast({
          title: 'Export failed',
          description: err instanceof Error ? err.message : 'Unable to export JSON config',
          variant: 'error',
        }),
    });
  };

  return (
    <Card title="Export Catalog" description="Download the catalog as OpenAPI or JSON.">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => handleExportOpenApi(false)} isLoading={exportOpenApi.isPending}>
          Export OpenAPI (YAML)
        </Button>
        <Button
          onClick={() => handleExportOpenApi(true)}
          variant="secondary"
          isLoading={exportOpenApi.isPending}
        >
          Export OpenAPI (JSON)
        </Button>
        <Button onClick={handleExportJson} variant="secondary" isLoading={exportJson.isPending}>
          Export JSON
        </Button>
        {(exportOpenApi.error || exportJson.error) && (
          <span className="text-sm text-red-600 dark:text-red-300">
            Failed to export: {String(exportOpenApi.error || exportJson.error)}
          </span>
        )}
      </div>
    </Card>
  );
}

export default ConfigExport;
