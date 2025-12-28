/**
 * FormFieldRenderer.tsx
 * Render individual form fields based on schema type
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2: Week 5 deliverable
 */

import React from 'react';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import type { FormField } from '@/types/apiCatalog';

interface FormFieldRendererProps {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (name: string, value: unknown) => void;
}

export function FormFieldRenderer({ field, value, error, onChange }: FormFieldRendererProps) {
  const id = `field-${field.name.replace(/\./g, '-')}`;

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            rows={4}
          />
        );
      case 'select':
        return (
          <select
            id={id}
            value={(value as string | number | undefined) ?? ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          >
            <option value="" disabled>
              {field.placeholder || 'Select an option'}
            </option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <label className="inline-flex items-center space-x-2">
            <input
              id={id}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(field.name, e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-neutral-800 dark:text-neutral-100">{field.label}</span>
          </label>
        );
      case 'radio':
        return (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((option) => (
              <label key={option.value} className="inline-flex items-center space-x-2">
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(field.name, option.value)}
                  className="h-4 w-4 border-neutral-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-neutral-800 dark:text-neutral-100">{option.label}</span>
              </label>
            ))}
          </div>
        );
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            value={value as number | string | undefined}
            className={error ? 'border-danger focus:border-danger focus:ring-danger/30' : undefined}
            onChange={(e) =>
              onChange(field.name, e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder={field.placeholder}
          />
        );
      case 'password':
      case 'email':
      case 'text':
      case 'date':
        return (
          <Input
            id={id}
            type={field.type === 'date' ? 'date' : field.type}
            value={(value as string | undefined) ?? ''}
            className={error ? 'border-danger focus:border-danger focus:ring-danger/30' : undefined}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
          />
        );
      case 'json':
        return (
          <textarea
            id={id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder || 'Provide JSON payload'}
            className="h-40 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 font-mono text-sm text-neutral-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        );
      default:
        return (
          <Input
            id={id}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            label={field.label}
            placeholder={field.placeholder}
            error={error}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      {field.type !== 'checkbox' && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-2"
        >
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
      )}
      {field.description && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{field.description}</p>
      )}

      {renderInput()}

      {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}

      {field.type === 'json' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(field.name, field.placeholder || '{}')}
          className="px-3 py-1 text-xs"
        >
          Insert hint
        </Button>
      )}
    </div>
  );
}

export default FormFieldRenderer;
