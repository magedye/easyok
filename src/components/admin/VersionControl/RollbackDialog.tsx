/**
 * RollbackDialog.tsx
 * Confirmation dialog for rolling back to previous version
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § VersionControl
 * Phase 2: Week 4 deliverable
 */

import React from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import type { ApiCatalogVersion } from '@/types/apiCatalog';

interface RollbackDialogProps {
  version: ApiCatalogVersion;
  onRollback: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isOpen?: boolean;
}

export function RollbackDialog({
  version,
  onRollback,
  onCancel,
  isLoading,
  isOpen = true,
}: RollbackDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Rollback catalog version">
      <div className="space-y-4 text-right">
        <p className="text-sm text-neutral-700 dark:text-neutral-200">
          Revert the catalog to <span className="font-semibold">{version.versionNumber}</span>. This will
          replace the current published configuration and may interrupt active sessions.
        </p>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm dark:border-yellow-700 dark:bg-yellow-900/30">
          <p className="font-semibold text-yellow-800 dark:text-yellow-200">Important</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-yellow-800 dark:text-yellow-100">
            <li>Endpoints and connections will revert to this snapshot.</li>
            <li>Any draft changes will remain saved but not active.</li>
            <li>Audit logs will record this rollback with your user ID.</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <div>
            <p className="text-xs uppercase text-neutral-500">Created</p>
            <p>{new Date(version.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500">Author</p>
            <p className="font-medium text-neutral-800 dark:text-neutral-100">{version.createdBy}</p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            onClick={onRollback}
            isLoading={isLoading}
          >
            {isLoading ? 'Rolling back...' : 'Confirm rollback'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default RollbackDialog;
