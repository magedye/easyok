import { useEffect, useState } from 'react';

import { apiListPendingTraining, apiApproveTraining } from '../api/rest';
import type { TrainingItem } from '../types/api';
import { Panel, StatusChip } from './UiPrimitives';

export default function FeedbackTrainingConsole() {
  const [pending, setPending] = useState<TrainingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ackChecklist, setAckChecklist] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiListPendingTraining();
      const json = await res.json();
      setPending(json || []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id: number) => {
    setMessage(null);
    try {
      const res = await apiApproveTraining(id);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Approval failed');
      }
      setMessage(`تمت الموافقة على العنصر ${id}`);
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Panel
      title="وحدة التغذية الراجعة والتدريب"
      description="المراجعة والموافقة هي الطريق الوحيد للتدريب. لا يوجد أي تعلم تلقائي."
      isRtl
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={load}
          className="px-3 py-1 rounded bg-gray-200 text-sm"
          disabled={loading}
        >
          تحديث
        </button>
        {message && <div className="text-sm text-blue-700">{message}</div>}
      </div>
      <div className="border rounded p-3 bg-amber-50 text-sm text-amber-900 space-y-1">
        <p className="font-semibold">قائمة مراجعة التصنيف (يجب تأكيدها قبل الموافقة):</p>
        <ul className="list-disc list-inside">
          <li>لا يحتوي على أسماء جداول/أعمدة محددة.</li>
          <li>يحسن المنطق والافتراضات وليس القيم المخزنة.</li>
          <li>لا يحتوي على SQL أو أرقام ثابتة (منع F/G/H).</li>
        </ul>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ackChecklist}
            onChange={(e) => setAckChecklist(e.target.checked)}
          />
          <span>أقر بمراجعة العناصر وفق التصنيف أعلاه.</span>
        </label>
      </div>
      {loading ? (
        <div className="text-sm text-gray-600">جاري التحميل...</div>
      ) : pending.length === 0 ? (
        <div className="text-sm text-gray-600">لا توجد عناصر تدريب معلّقة.</div>
      ) : (
        <div className="space-y-2">
          {pending.map((item) => (
            <div
              key={item.id}
              className="border rounded p-3 flex items-center justify-between bg-white shadow-sm"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold">ID: {item.id}</div>
                <div className="text-xs text-gray-600">النوع: {item.type}</div>
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  الحالة: <StatusChip label={item.status} status={item.status as any} />
                </div>
                {item.created_at && (
                  <div className="text-xs text-gray-500">أنشئ في: {item.created_at}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleApprove(item.id)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                disabled={!ackChecklist}
              >
                موافقة
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-600">
        ملاحظة: لا يتم تشغيل أي تدريب دون موافقة. استخدم هذه الوحدة لتفعيل التعلم بعد التغذية الراجعة.
      </p>
    </Panel>
  );
}
