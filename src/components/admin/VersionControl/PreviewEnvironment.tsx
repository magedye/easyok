/**
 * PreviewEnvironment.tsx
 * Compare preview vs. live endpoints, test against sandbox
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § VersionControl
 * Phase 2b: Week 3 deliverable
 */

import React from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { useCatalogVersions } from '@/hooks/useApiCatalog';

export function PreviewEnvironment() {
  const { versions } = useCatalogVersions();
  const currentPreview = versions.find(v => v.status === 'preview');

  const handleTestEndpoint = (endpointId: string) => {
    // Logic to run APIClient test using the preview version's token/config
    console.log(`Testing endpoint ${endpointId} against preview environment...`);
    // Placeholder for actual API call via a dedicated test hook
    alert(`Test request sent to preview for: ${endpointId}`);
  };

  if (!currentPreview) {
    return (
      <Card title="Preview Environment" className="border-l-4 border-l-neutral-400">
        <p className="text-neutral-500">No version is currently staged for preview.</p>
        <p className="text-sm mt-2">
          Promote a draft version to 'Preview' status in the Version History tab to enable sandbox testing.
        </p>
      </Card>
    );
  }

  return (
    <Card title={`Preview: Version ${currentPreview.versionNumber}`} description="Test pending changes against the sandbox environment before publishing." className="border-l-4 border-l-yellow-500">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <span className="text-sm font-medium">Status</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Preview Active
          </span>
        </div>
        
        <h4 className="font-semibold text-neutral-700 dark:text-neutral-300">
          Modified Endpoints ({currentPreview.changes?.length || 0})
        </h4>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {currentPreview.changes && currentPreview.changes.length > 0 ? (
            currentPreview.changes
              .filter(c => c.type === 'endpoint')
              .map((change) => {
                const endpoint = currentPreview.endpoints.find(e => e.id === change.id);
                if (!endpoint) return null;

                return (
                  <div key={change.id} className="flex items-center justify-between p-3 border-b border-neutral-100 dark:border-neutral-700">
                    <div className="min-w-0 flex-1 me-4">
                      <code className="text-sm font-mono text-brand-600 dark:text-brand-400 truncate block">
                        [{endpoint.method}] {endpoint.path}
                      </code>
                      <p className="text-xs text-neutral-500">{endpoint.name}</p>
                    </div>
                    <Button onClick={() => handleTestEndpoint(endpoint.id)} variant="secondary" size="sm">
                      Test
                    </Button>
                  </div>
                );
              })
          ) : (
            <p className="text-sm text-neutral-500">No changes detected in this preview version.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default PreviewEnvironment;
