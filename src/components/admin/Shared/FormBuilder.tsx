/**
 * FormBuilder.tsx
 * Convert JSON Schema to React form with dynamic field rendering
 * Reference: src/utils/formGenerator.ts
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2: Week 5 deliverable
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { FormFieldRenderer } from './FormFieldRenderer';
import { schemaToFormFields, transformFormData, validateFormData } from '@/utils/formGenerator';
import type { FormField, JsonSchema } from '@/types/apiCatalog';

interface FormBuilderProps {
  schema: JsonSchema;
  initialValues?: Record<string, unknown>;
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>;
  onChange?: (data: Record<string, unknown>) => void;
  submitLabel?: string;
}

const getValueByPath = (data: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, data);

const setValueByPath = (data: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split('.');
  const newData = { ...data };
  let current: Record<string, unknown> = newData;

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    const existing = current[part];
    if (!existing || typeof existing !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });

  return newData;
};

const validateFields = (fields: FormField[], data: Record<string, unknown>) => {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    const value = getValueByPath(data, field.name);
    const isEmpty = value === undefined || value === null || value === '';

    if (field.required && isEmpty) {
      errors[field.name] = `${field.label} is required`;
      return;
    }

    if (!field.validation || isEmpty) return;

    if (field.validation.minLength && typeof value === 'string' && value.length < field.validation.minLength) {
      errors[field.name] = `Minimum ${field.validation.minLength} characters`;
    }

    if (field.validation.maxLength && typeof value === 'string' && value.length > field.validation.maxLength) {
      errors[field.name] = `Maximum ${field.validation.maxLength} characters`;
    }

    if (field.validation.minimum !== undefined && typeof value === 'number' && value < field.validation.minimum) {
      errors[field.name] = `Minimum value is ${field.validation.minimum}`;
    }

    if (field.validation.maximum !== undefined && typeof value === 'number' && value > field.validation.maximum) {
      errors[field.name] = `Maximum value is ${field.validation.maximum}`;
    }

    if (field.validation.pattern && typeof value === 'string' && !new RegExp(field.validation.pattern).test(value)) {
      errors[field.name] = 'Invalid format';
    }
  });

  return errors;
};

export function FormBuilder({
  schema,
  initialValues,
  onSubmit,
  onChange,
  submitLabel = 'Save',
}: FormBuilderProps) {
  const fields = useMemo(() => schemaToFormFields(schema), [schema]);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues) {
      setFormData(initialValues);
    }
  }, [initialValues]);

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData((prev) => {
      const updated = setValueByPath(prev, name, value);
      onChange?.(updated);
      return updated;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const schemaValidation = validateFormData(formData, schema);
    const fieldValidation = validateFields(fields, formData);
    const combinedErrors = { ...schemaValidation.errors, ...fieldValidation };
    setErrors(combinedErrors);

    const hasErrors =
      !schemaValidation.valid || Object.keys(fieldValidation).length > 0 || Object.keys(combinedErrors).length > 0;

    if (hasErrors) {
      setSubmitError('Please resolve the highlighted fields.');
      return;
    }

    const payload = transformFormData(formData, schema);
    await onSubmit?.(payload);
  };

  return (
    <Card>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <FormFieldRenderer
            key={field.name}
            field={field}
            value={getValueByPath(formData, field.name)}
            error={errors[field.name]}
            onChange={handleFieldChange}
          />
        ))}

        {submitError && <p className="text-sm text-red-600 dark:text-red-300">{submitError}</p>}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFormData(initialValues || {});
              setErrors({});
              setSubmitError(null);
            }}
          >
            Reset
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}

export default FormBuilder;
