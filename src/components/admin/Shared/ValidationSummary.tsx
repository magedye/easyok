/**
 * ValidationSummary.tsx
 * Display all validation issues grouped by severity
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2b: Week 4 deliverable
 */

import React from 'react';
import clsx from 'classnames';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import type { ValidationResult } from '@/types/apiCatalog';

interface ValidationSummaryProps {
  validationResult?: ValidationResult;
  onFixAll?: () => void;
  onRerun?: () => void;
  isLoading?: boolean;
}

export function ValidationSummary({ validationResult, onFixAll, onRerun, isLoading }: ValidationSummaryProps) {
  if (!validationResult) {
    return (
      <Card title="Validation Status">
        <p className="text-neutral-500">Run validation to check catalog integrity.</p>
        <Button onClick={onRerun} disabled={isLoading} variant="secondary" className="mt-4">
          {isLoading ? 'Running...' : 'Run Validation'}
        </Button>
      </Card>
    );
  }

  const hasErrors = validationResult.errors && validationResult.errors.length > 0;
  const hasWarnings = validationResult.warnings && validationResult.warnings.length > 0;

  const title = hasErrors
    ? 'Validation Failed'
    : hasWarnings
    ? 'Validation Passed with Warnings'
    : 'Validation Successful';
  const color = hasErrors ? 'border-l-red-500' : hasWarnings ? 'border-l-yellow-500' : 'border-l-green-500';
  const icon = hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅';

  const renderIssueList = (
    issues: ValidationResult['errors'] | ValidationResult['warnings'],
    type: 'error' | 'warning',
  ) => {
    if (!issues || issues.length === 0) return null;

    const baseClass =
      type === 'error'
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-800 dark:text-red-300'
        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 text-yellow-800 dark:text-yellow-300';

    return (
      <div className={clsx('p-4 border rounded-lg space-y-2', baseClass)}>
        <h4 className="text-lg font-semibold capitalize">
          {type === 'error' ? 'Errors' : 'Warnings'} ({issues.length})
        </h4>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {issues.map((issue, index) => (
            <li key={index}>
              <span className="font-medium">{issue.field}:</span> {issue.message}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Card title={title} className={clsx('border-l-4', color)}>
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-xl">{icon}</span>
          <p>
            {validationResult.valid
              ? 'Catalog is structurally and logically sound.'
              : 'Critical issues found that prevent immediate publishing.'}
          </p>
        </div>

        {renderIssueList(validationResult.errors, 'error')}
        {renderIssueList(validationResult.warnings, 'warning')}

        <div className="flex justify-end space-x-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          {onFixAll && hasErrors && (
            <Button onClick={onFixAll} variant="secondary" className="bg-red-600 hover:bg-red-700">
              Attempt Auto-Fix
            </Button>
          )}
          <Button onClick={onRerun} disabled={isLoading} variant="primary">
            {isLoading ? 'Rerunning...' : 'Rerun Validation'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ValidationSummary;
