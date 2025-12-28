/**
 * BulkActions.tsx
 * Apply actions to multiple endpoints/connections
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2b: Week 4 deliverable
 */

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';

interface BulkActionsProps {
  selectedIds: string[];
  onDelete?: (ids: string[]) => void;
  resourceName?: string;
}

export function BulkActions({ selectedIds, onDelete, resourceName = 'items' }: BulkActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasSelection = selectedIds.length > 0;
  const selectionLabel = useMemo(
    () => `${selectedIds.length} ${resourceName}`,
    [selectedIds.length, resourceName],
  );

  if (!hasSelection) return null;

  const handleDelete = () => {
    if (!onDelete) return;
    onDelete(selectedIds);
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-40 w-[min(90%,36rem)] -translate-x-1/2 transform rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Bulk actions</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Selected {selectionLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={!onDelete}
              className="text-red-600 hover:text-red-700"
            >
              Delete Selected
            </Button>
          </div>
        </div>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm deletion">
        <div className="space-y-4">
          <p className="text-sm text-neutral-700 dark:text-neutral-200">
            Delete {selectionLabel}? This action cannot be undone.
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            Ensure you have the right selection before proceeding.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete {selectedIds.length}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default BulkActions;
