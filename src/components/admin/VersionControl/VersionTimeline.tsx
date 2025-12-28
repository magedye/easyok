import React from 'react';
import type { ApiCatalogVersion } from '@/types/apiCatalog';
import clsx from 'classnames';

interface VersionTimelineProps {
  versions: ApiCatalogVersion[];
  selectedId?: string;
  onSelect: (version: ApiCatalogVersion) => void;
  isLoading: boolean;
  error: unknown;
}

const STATUS_COLORS = {
  published: 'bg-green-500',
  preview: 'bg-yellow-500',
  draft: 'bg-neutral-400',
};

export function VersionTimeline({ versions, selectedId, onSelect, isLoading, error }: VersionTimelineProps) {
  if (isLoading) {
    return <div className="text-center text-sm text-neutral-500">Loading versions...</div>;
  }

  if (error) {
    return <div className="text-center text-sm text-red-500">Error loading versions.</div>;
  }

  if (versions.length === 0) {
    return <div className="text-center text-sm text-neutral-500">No versions found.</div>;
  }

  return (
    <div className="relative border-s border-neutral-200 dark:border-neutral-700 space-y-6 pt-2 ps-4">
      {versions.map((version, index) => {
        const isActive = version.id === selectedId;
        const color = STATUS_COLORS[version.status] || STATUS_COLORS.draft;

        return (
          <div
            key={version.id}
            className={clsx(
              'relative mb-6 ms-4 cursor-pointer p-4 rounded-lg transition-all',
              isActive
                ? 'bg-brand-50 border border-brand-500 shadow-lg dark:bg-brand-900/20'
                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
            )}
            onClick={() => onSelect(version)}
          >
            {/* Timeline Dot */}
            <div
              className={clsx(
                'absolute -start-2.5 h-4 w-4 rounded-full border-2 border-white dark:border-neutral-900',
                color
              )}
            />

            {/* Content */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white truncate">
                  Version {version.versionNumber}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {version.description || 'No description provided'}
                </p>
                <time className="block text-xs font-normal leading-none text-neutral-400 dark:text-neutral-500 mt-1">
                  Created by {version.createdBy} on {new Date(version.createdAt).toLocaleDateString()}
                </time>
              </div>

              {/* Status Badge */}
              <span
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium capitalize',
                  version.status === 'published' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                  version.status === 'preview' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                  version.status === 'draft' && 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                )}
              >
                {version.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VersionTimeline;