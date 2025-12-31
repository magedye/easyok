import { useEffect, useMemo, useState } from 'react';
import { SIGNOZ_DASHBOARD_URL } from '../../config';
import { apiGetSentryIssues, apiListFeatureToggles, apiUpdateFeatureToggle } from '../../api/rest';
import { Panel } from '../../components/UiPrimitives';

type FeatureToggle = {
  name: string;
  value: boolean;
  mutable: boolean;
};

type SentryIssue = {
  id: string;
  title: string;
  culprit?: string;
  lastSeen?: string;
  level?: string;
  permalink?: string;
  trace_id?: string;
};

type DashboardProps = {
  role?: 'admin' | 'viewer';
};

export default function UnifiedDashboard({ role = 'viewer' }: DashboardProps) {
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<FeatureToggle | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === 'admin';

  const signozUrl = useMemo(() => SIGNOZ_DASHBOARD_URL.trim(), []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ftRes, sentryRes] = await Promise.all([
        apiListFeatureToggles(),
        apiGetSentryIssues()
      ]);
      if (ftRes.ok) {
        const data = await ftRes.json();
        setFeatures(data.features || []);
      } else {
        setError('Failed to load feature toggles');
      }
      if (sentryRes.ok) {
        const data = await sentryRes.json();
        setIssues(data.issues || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (feature: FeatureToggle) => {
    if (!isAdmin) return;
    setToggleTarget(feature);
    setReason('');
    setError(null);
  };

  const confirmChange = async () => {
    if (!isAdmin) return;
    if (!toggleTarget) return;
    if (!reason || reason.length < 10) {
      setError('Reason is required (min 10 chars)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiUpdateFeatureToggle({
        feature: toggleTarget.name,
        value: !toggleTarget.value,
        reason
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || 'Toggle update failed');
      } else {
        setToggleTarget(null);
        await loadData();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl" data-testid="admin-dashboard">
      <h1 className="text-2xl font-semibold text-gray-900">Unified Control & Observability</h1>
      {error && <div className="bg-red-100 text-red-800 border border-red-200 p-3 rounded">{error}</div>}

      <Panel
        title="SigNoz Dashboard"
        description="Single-pane observability (read-only)."
        isRtl
      >
        {signozUrl ? (
          <iframe
            title="SigNoz"
            src={signozUrl}
            className="w-full h-[480px] border border-gray-200 rounded"
            allow="fullscreen"
          />
        ) : (
          <p className="text-sm text-gray-600">
            SigNoz dashboard URL not configured (set VITE_SIGNOZ_DASHBOARD_URL).
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Sentry Issues"
          description="Latest 5 issues (read-only, deep-link to Sentry)."
          isRtl
        >
          {issues.length === 0 ? (
            <p className="text-sm text-gray-600">No issues available.</p>
          ) : (
            <ul className="space-y-3">
              {issues.map((issue) => (
                <li key={issue.id} className="border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{issue.title}</span>
                    <span className="text-xs text-gray-500">{issue.level}</span>
                  </div>
                  {issue.culprit && <div className="text-sm text-gray-700 mt-1">{issue.culprit}</div>}
                  <div className="text-xs text-gray-500 mt-1">
                    آخر ظهور: {issue.lastSeen || 'غير معروف'}
                  </div>
                  <div className="text-xs text-gray-500">Trace: {issue.trace_id || 'n/a'}</div>
                  {issue.permalink && (
                    <a
                      className="text-blue-600 text-xs mt-1 inline-block"
                      href={issue.permalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      فتح في Sentry
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Feature Toggles (Admin)"
          description="Runtime-safe toggles only. Immutable settings are view-only."
          isRtl
        >
          {loading && <div className="text-sm text-gray-600">Loading...</div>}
          <div className="space-y-3">
            {features.map((ft) => (
              <div
                key={ft.name}
                className="flex items-center justify-between border border-gray-200 rounded px-3 py-2"
              >
                <div>
                  <div className="font-semibold">{ft.name}</div>
                  <div className="text-xs text-gray-500">القيمة الحالية: {String(ft.value)}</div>
                  {!ft.mutable && (
                    <div className="text-xs text-red-600">Immutable (security-critical)</div>
                  )}
                </div>
                <button
                  className={`px-3 py-1 text-sm rounded ${
                    ft.mutable && isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!ft.mutable || loading || !isAdmin}
                  onClick={() => ft.mutable && isAdmin && openModal(ft)}
                >
                  تبديل
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {toggleTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md space-y-4" dir="rtl">
            <h2 className="text-lg font-semibold">تأكيد التغيير</h2>
            <p className="text-sm text-gray-700">
              سيتم تغيير {toggleTarget.name} من {String(toggleTarget.value)} إلى{' '}
              {String(!toggleTarget.value)}. أدخل سببًا واضحًا (إلزامي).
            </p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isAdmin || loading}
              readOnly={!isAdmin}
              placeholder="سبب التغيير (10 أحرف على الأقل)"
            />
            <div className="flex justify-end space-x-2 space-x-reverse">
              <button
                className="px-3 py-1 rounded border border-gray-300"
                onClick={() => setToggleTarget(null)}
                disabled={loading || !isAdmin}
              >
                إلغاء
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white"
                onClick={confirmChange}
                disabled={loading || !isAdmin}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
