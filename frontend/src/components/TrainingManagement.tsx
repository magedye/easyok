import { useState } from 'react';

import { apiUploadDDL, apiUploadTraining } from '../api/rest';
import { Panel } from './UiPrimitives';

export default function TrainingManagement() {
  const [ddl, setDdl] = useState('');
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitDDL = async () => {
    if (!ddl.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiUploadDDL(ddl);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'DDL upload failed');
      }
      setMessage('تم رفع DDL وإدخاله في الحوكمة (بانتظار الموافقة)');
      setDdl('');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const submitManual = async () => {
    if (!question.trim() || !sql.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiUploadTraining({ question: question.trim(), sql: sql.trim() });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Training upload failed');
      }
      setMessage('تم رفع السؤال/SQL للحكومة (بانتظار الموافقة)');
      setQuestion('');
      setSql('');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Panel
        title="إدارة التدريب الحاكم"
        description="رفع DDL وأزواج سؤال/SQL تحت الحوكمة الصارمة (لا تدريب تلقائي)."
        isRtl
      >
        {message && <div className="text-sm text-blue-700 mb-2">{message}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-gray-900">رفع DDL</h3>
            <p className="text-xs text-gray-600">يتم إرسال DDL للمراجعة ولا يُدرّب إلا بعد الموافقة.</p>
            <textarea
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
              rows={6}
              className="w-full border rounded p-2 text-sm"
              placeholder="أدخل DDL"
            />
            <button
              type="button"
              onClick={submitDDL}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
              disabled={loading}
            >
              رفع DDL
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-gray-900">رفع سؤال - SQL</h3>
            <p className="text-xs text-gray-600">يظل في حالة pending حتى موافقة المشرف.</p>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full border rounded p-2 text-sm"
              placeholder="السؤال"
            />
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={4}
              className="w-full border rounded p-2 text-sm"
              placeholder="الاستعلام SQL"
            />
            <button
              type="button"
              onClick={submitManual}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
              disabled={loading}
            >
              رفع سؤال/SQL
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          جميع العناصر تبقى في حالة pending حتى الموافقة. المسار الوحيد للتدريب هو الموافقة اليدوية.
        </p>
      </Panel>
    </div>
  );
}
