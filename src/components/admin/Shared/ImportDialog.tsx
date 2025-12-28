/**
 * ImportDialog.tsx
 * Upload OpenAPI spec or JSON config file
 * * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § Shared Components
 * Phase 2b: Week 4 deliverable
 */

import React, { useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { useCatalogImportExport } from '@/hooks/useApiCatalog';
import { useToast } from '@/components/shared/Toast';

export function ImportDialog() {
  const { importOpenApi } = useCatalogImportExport();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [format, setFormat] = useState<'json' | 'yaml' | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const { showToast } = useToast();

  const detectAndPreview = async (selectedFile: File) => {
    setParseError(null);
    setPreview(null);
    setFormat(null);
    setValidationErrors([]);
    setSummary(null);
    try {
      const content = await selectedFile.text();
      try {
        const parsed = JSON.parse(content);
        setPreview(JSON.stringify(parsed, null, 2).slice(0, 800));
        setFormat('json');
      } catch {
        // Lazy-load yaml parser to avoid upfront bundle size
        const yaml = await import('js-yaml');
        const parsed = yaml.load(content);
        setPreview(JSON.stringify(parsed, null, 2).slice(0, 800));
        setFormat('yaml');
      }
    } catch (err) {
      setParseError('Unable to read file contents.');
      console.error(err);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile && !/\.(json|ya?ml)$/i.test(nextFile.name)) {
      setFile(null);
      setPreview(null);
      setFormat(null);
      setParseError('Only .json or .yaml/.yml files are supported.');
      return;
    }
    setFile(nextFile || null);
    if (nextFile) {
      void detectAndPreview(nextFile);
    } else {
      setPreview(null);
      setParseError(null);
      setFormat(null);
      setValidationErrors([]);
      setSummary(null);
    }
  };

  const handleImport = () => {
    if (!file) {
      setParseError('Please select a JSON or YAML file to import.');
      return;
    }
    setParseError(null);

    importOpenApi.mutate(file, {
      onSuccess: (result) => {
        setParseError(null);
        const errors = result.errors ?? [];
        setValidationErrors(errors);
        const partial = errors.length > 0;
        const message = partial
          ? `Imported ${result.imported}, updated ${result.updated}, with ${errors.length} issues.`
          : `Imported ${result.imported}, updated ${result.updated}.`;
        setSummary(message);
        showToast({
          title: partial ? 'Catalog import completed with warnings' : 'Catalog import queued',
          description: message,
          variant: partial ? 'info' : 'success',
        });
        setFile(null);
        setPreview(null);
        setFormat(null);
        if (!partial) {
          setValidationErrors([]);
        }
      },
      onError: (err: any) => {
        const apiErrors = err?.response?.data?.errors;
        const description = err instanceof Error ? err.message : 'Import failed';
        if (Array.isArray(apiErrors) && apiErrors.length > 0) {
          setValidationErrors(apiErrors.map(String));
          setParseError(null);
          showToast({
            title: 'Import failed',
            description: apiErrors[0],
            variant: 'error',
          });
        } else {
          setValidationErrors([]);
          setParseError(description);
          showToast({ title: 'Import failed', description, variant: 'error' });
        }
      },
    });
  };

  return (
    <Card
      title="Import Catalog"
      description="Upload an OpenAPI or JSON file to replace the draft catalog."
      className="space-y-4"
    >
      <input
        id="catalog-import-file"
        type="file"
        accept=".json,.yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />
      <label
        htmlFor="catalog-import-file"
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-600 transition hover:border-brand-400 hover:bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        <span className="font-semibold text-neutral-800 dark:text-neutral-100">
          Drop JSON/YAML or click to browse
        </span>
        <span className="mt-1 text-xs text-neutral-500">
          We validate the file before sending it to the catalog service.
        </span>
        {file && (
          <span className="mt-2 inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
            {file.name}
          </span>
        )}
      </label>

      {preview && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-left text-xs font-mono text-neutral-700 shadow-inner dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wide">{format === 'yaml' ? 'YAML' : 'JSON'} preview</span>
            <span className="text-[11px] text-neutral-500">Truncated preview</span>
          </div>
          <pre className="max-h-52 overflow-auto whitespace-pre-wrap">{preview}</pre>
        </div>
      )}

      {parseError && <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}
      {summary && <p className="text-sm text-neutral-700 dark:text-neutral-200">{summary}</p>}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          <p className="font-semibold mb-2">Import errors</p>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleImport} isLoading={importOpenApi.isPending} disabled={!file}>
          Import File
        </Button>
        {file && (
          <span className="text-sm text-neutral-600 dark:text-neutral-300">
            {format ? `Detected ${format.toUpperCase()} file` : 'File selected'}
          </span>
        )}
      </div>
    </Card>
  );
}

export default ImportDialog;
