/**
 * EndpointEditor.tsx
 * Modal for editing single endpoint with tabs for details/schema/examples
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § EndpointManager
 * Phase 2b: Week 1 deliverable
 */

import { useState } from 'react'
import type { ApiEndpoint } from '@/types/apiCatalog'
import { Modal } from '@/components/shared/Modal'
import { EndpointForm } from './EndpointForm'
import { EndpointPreview } from './EndpointPreview'
import clsx from 'classnames'

interface EndpointEditorProps {
  endpoint?: ApiEndpoint
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<ApiEndpoint>) => void | Promise<void>
  isSubmitting?: boolean
}

type Tab = 'edit' | 'preview'

export function EndpointEditor({
  endpoint,
  isOpen,
  onClose,
  onSave,
  isSubmitting,
}: EndpointEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('edit')

  const handleSave = async (data: Partial<ApiEndpoint>) => {
    await onSave(data)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {endpoint ? 'Edit Endpoint' : 'New Endpoint'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            disabled={isSubmitting}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 border-b border-neutral-200 dark:border-neutral-700 mb-6">
          <button
            onClick={() => setActiveTab('edit')}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'edit'
                ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
            )}
          >
            Edit Details
          </button>
          {endpoint && (
            <button
              onClick={() => setActiveTab('preview')}
              className={clsx(
                'px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'preview'
                  ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              Preview
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="max-h-[70vh] overflow-y-auto">
          {activeTab === 'edit' && (
            <EndpointForm
              endpoint={endpoint}
              onSubmit={handleSave}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          )}

          {activeTab === 'preview' && endpoint && (
            <EndpointPreview endpoint={endpoint} />
          )}
        </div>
      </div>
    </Modal>
  )
}

export default EndpointEditor
