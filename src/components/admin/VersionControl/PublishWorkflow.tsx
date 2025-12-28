/**
 * PublishWorkflow.tsx
 * Multi-step wizard for publishing catalog versions (draft → preview → publish)
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § VersionControl
 * Phase 2: Week 4 deliverable
 */

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { Skeleton } from '@/components/shared/Skeleton';
import { useCatalogValidation, useCatalogVersions } from '@/hooks/useApiCatalog';
import { ValidationSummary } from '../Shared/ValidationSummary';
import DiffViewer from './DiffViewer';
import type { ApiCatalogVersion, ValidationResult } from '@/types/apiCatalog';
import { useToast } from '@/components/shared/Toast';

const steps = [
  { id: 1, title: 'Review changes', description: 'Compare draft vs published' },
  { id: 2, title: 'Run validation', description: 'Verify schemas and connections' },
  { id: 3, title: 'Confirm publish', description: 'Finalize and distribute' },
];

interface PublishWorkflowProps {
  version?: ApiCatalogVersion;
  onComplete?: () => void;
}

export function PublishWorkflow({ version, onComplete }: PublishWorkflowProps) {
  const { versions, isLoading, publish, refetch } = useCatalogVersions();
  const { validate } = useCatalogValidation();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [validationResult, setValidationResult] = useState<ValidationResult | undefined>(undefined);
  const hasValidationResult = !!validationResult;
  const hasErrors = (validationResult?.errors?.length ?? 0) > 0;
  const canProceedAfterValidation = hasValidationResult && !hasErrors;

  const draftVersion = useMemo<ApiCatalogVersion | undefined>(() => {
    if (version) return version;
    return versions.find((v) => v.status === 'draft') || versions.find((v) => v.status !== 'published');
  }, [version, versions]);

  const publishedVersion = useMemo<ApiCatalogVersion | undefined>(
    () => versions.find((v) => v.status === 'published') || versions.find((v) => v.id !== draftVersion?.id),
    [draftVersion?.id, versions],
  );

  const handleValidate = () => {
    if (!draftVersion) return;
    validate.mutate(draftVersion.id, {
      onSuccess: (data) => {
        setValidationResult({
          valid: data.valid,
          errors: data.errors?.map((message) => ({ field: 'catalog', message })),
          warnings: data.valid
            ? [{ field: 'health', message: 'Run latency checks before publishing to prod.' }]
            : undefined,
        });
      },
      onError: () => {
        setValidationResult({
          valid: false,
          errors: [{ field: 'system', message: 'Validation service unavailable' }],
        });
      },
    });
  };

  const handlePublish = () => {
    if (!draftVersion) return;
    publish.mutate(draftVersion.id, {
      onSuccess: () => {
        showToast({
          title: 'Catalog published',
          description: `Version ${draftVersion.versionNumber} is now live.`,
          variant: 'success',
        });
        setCurrentStep(1);
        setValidationResult(undefined);
        refetch();
        onComplete?.();
      },
      onError: (err) =>
        showToast({
          title: 'Publish failed',
          description: err instanceof Error ? err.message : 'Unable to publish version.',
          variant: 'error',
        }),
    });
  };

  const nextDisabled =
    currentStep === 1
      ? !draftVersion || !publishedVersion
      : currentStep === 2
      ? !canProceedAfterValidation
      : false;

  const renderStepContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    if (!draftVersion) {
      return <p className="text-sm text-neutral-500">No draft version available to publish.</p>;
    }

    switch (currentStep) {
      case 1:
        return publishedVersion ? (
          <DiffViewer from={publishedVersion} to={draftVersion} />
        ) : (
          <p className="text-sm text-neutral-500">There is no published version to compare.</p>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Run full validation for schemas, endpoints, and connection health before publishing.
            </p>
            <Button onClick={handleValidate} isLoading={validate.isPending} disabled={validate.isPending}>
              {validate.isPending ? 'Validating...' : 'Run validation'}
            </Button>
            {hasErrors && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                Validation failed. Resolve critical errors before publishing.
              </div>
            )}
            <ValidationSummary
              validationResult={validationResult}
              onRerun={handleValidate}
              isLoading={validate.isPending}
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900">
              <p className="font-semibold text-neutral-900 dark:text-white">
                Publish version {draftVersion.versionNumber} to production?
              </p>
              <p className="text-neutral-600 dark:text-neutral-300">
                Status will change to <span className="font-semibold">published</span> and endpoints will
                be distributed to all clients.
              </p>
              <p className="text-xs text-neutral-500">
                Created {new Date(draftVersion.createdAt).toLocaleString()} by {draftVersion.createdBy}
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card title="Publish Workflow" description="Review a draft version and publish with validation checks.">
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          return (
            <div
              key={step.id}
              className={`rounded-xl border p-4 ${isActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {step.title}
                </span>
                {isComplete && <span className="text-sm text-green-500">✓</span>}
              </div>
              <p className="text-xs text-neutral-500 mt-1">{step.description}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">{renderStepContent()}</div>

      <div className="mt-6 flex justify-between">
        <Button
          variant="ghost"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
        >
          Back
        </Button>
        <div className="flex gap-3">
          {currentStep < 3 && (
            <Button
              variant="secondary"
              onClick={() => setCurrentStep((prev) => Math.min(3, prev + 1))}
              disabled={nextDisabled}
            >
              Next
            </Button>
          )}
          {currentStep === 3 && (
            <Button
              onClick={handlePublish}
              isLoading={publish.isPending}
              disabled={!canProceedAfterValidation}
            >
              {publish.isPending ? 'Publishing...' : 'Publish to production'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default PublishWorkflow;
