import React from 'react';

type PanelProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  isRtl?: boolean;
};

export function Panel({ title, description, children, isRtl = false }: PanelProps) {
  return (
    <section
      className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-2 ${
        isRtl ? 'rtl' : 'ltr'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

type StatusChipProps = {
  label: string;
  status: 'pending' | 'approved' | 'rejected';
};

export function StatusChip({ label, status }: StatusChipProps) {
  const color =
    status === 'approved'
      ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'rejected'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold border rounded ${color}`}>
      {label}
    </span>
  );
}
