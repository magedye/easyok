import { useMemo } from 'react';

import { useRunHistory } from '../hooks/useRunHistory';
import { Panel, StatusChip } from './UiPrimitives';

export default function LearningValidationView() {
  const { entries, clear } = useRunHistory();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>();
    entries.forEach((e) => {
      const key = e.question;
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [entries]);

  return (
    <Panel
      title="عرض التحقق بعد التعلم"
      description="عرض شفاف قبل/بعد بدون أي منطق تقييم تلقائي."
      isRtl
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1 text-sm bg-gray-200 rounded"
        >
          مسح السجل
        </button>
      </div>
      {grouped.length === 0 ? (
        <div className="text-sm text-gray-600">لا يوجد سجل تشغيل لعرضه.</div>
      ) : (
        grouped.map(([question, runs]) => (
          <div key={question} className="border rounded p-3 bg-white shadow-sm space-y-2">
            <div className="text-sm font-semibold text-gray-900">{question}</div>
            {runs.slice(0, 2).map((r) => (
              <div key={r.id} className="border rounded p-2 text-sm">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{new Date(r.timestamp).toLocaleString()}</span>
                  <StatusChip label={r.status} status={r.status === 'success' ? 'approved' : 'pending'} />
                </div>
                <div className="mt-1">
                  <div className="font-medium">SQL</div>
                  <pre className="bg-gray-100 rounded p-2 text-xs overflow-auto max-h-32">
                    {r.technicalView?.sql || 'غير متوفر'}
                  </pre>
                </div>
                <div className="mt-1">
                  <div className="font-medium">الافتراضات</div>
                  <ul className="list-disc list-inside">
                    {r.technicalView?.assumptions?.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    )) || <li>غير متوفر</li>}
                  </ul>
                </div>
                <div className="mt-1">
                  <div className="font-medium">الملخص</div>
                  <div>
                    {typeof r.summary === 'string'
                      ? r.summary
                      : (r.summary as any)?.text || 'غير متوفر'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
      <p className="text-xs text-gray-600">
        الهدف عرض ما قبل/بعد التعلم بدون أي منطق تقييم تلقائي.
      </p>
    </Panel>
  );
}
