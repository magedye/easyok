/**
 * SchemaValidator.tsx
 * Trigger validation and display results via ValidationSummary
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2b: Week 4 deliverable
 */

import React, { useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { useCatalogValidation } from '@/hooks/useApiCatalog';
import { ValidationSummary } from './ValidationSummary';
import type { ValidationResult } from '@/types/apiCatalog';

export function SchemaValidator() {
  const { validate } = useCatalogValidation();
  const [result, setResult] = useState<ValidationResult | undefined>(undefined);

  const handleRunValidation = () => {
    validate.mutate(undefined, {
      onSuccess: (data) => {
        const normalized: ValidationResult = {
          valid: data.valid,
          errors: data.errors
            ? data.errors.map((message) => ({
                field: 'general',
                message,
              }))
            : undefined,
          warnings: data.valid
            ? [{ field: 'connections', message: 'Latency checks recommended before publish.' }]
            : undefined,
        };

        setResult(normalized);
      },
      onError: () => {
        setResult({
          valid: false,
          errors: [{ field: 'system', message: 'Backend validation service is unavailable.' }],
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Catalog Validator</h2>
      <Card description="Check the structural integrity, schema validity, and health of all endpoints before publishing.">
        {validate.isIdle && !result && (
          <div className="py-4 text-center">
            <p className="mb-4 text-lg font-medium text-neutral-600 dark:text-neutral-400">
              Ready to verify the Draft Catalog.
            </p>
            <Button onClick={handleRunValidation} variant="primary" isLoading={validate.isPending}>
              Run Full Validation Check
            </Button>
          </div>
        )}

        {validate.isPending && (
          <div className="py-8 text-center">
            <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">Analyzing schema and connections...</p>
          </div>
        )}

        {result && (
          <ValidationSummary
            validationResult={result}
            onRerun={handleRunValidation}
            isLoading={validate.isPending}
          />
        )}
      </Card>
    </div>
  );
}

export default SchemaValidator;
