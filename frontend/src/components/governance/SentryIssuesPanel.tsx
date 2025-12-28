import { useEffect, useState } from "react";
import { api } from "../../api/generated/client";
import LoadingState from "../LoadingState";

type Issue = {
  id: string;
  title: string;
  trace_id?: string;
  lastSeen?: string;
};

export default function SentryIssuesPanel() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/v1/admin/settings/sentry-issues")
      .then((res) => {
        if (!mounted) return;
        // @ts-expect-error zod validated
        setIssues((res.issues as Issue[]) || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "failed to load issues");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    throw new Error(error);
  }
  if (issues === null) {
    return <LoadingState />;
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 space-y-3" dir="rtl">
      <div className="text-lg font-semibold">Sentry Issues</div>
      {issues.length === 0 ? (
        <div className="text-sm text-gray-600">لا توجد مشاكل حالياً.</div>
      ) : (
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="text-gray-600">
              <th className="pb-2">العنوان</th>
              <th className="pb-2">Trace ID</th>
              <th className="pb-2">آخر ظهور</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="py-2">{i.title}</td>
                <td className="py-2">{i.trace_id || "غير متوفر"}</td>
                <td className="py-2">{i.lastSeen || "غير متوفر"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
