import { useEffect, useState } from "react";
import { api } from "../../api/generated/client";
import LoadingState from "../../components/LoadingState";

type MetricsResponse = {
  baseline: Record<string, unknown>;
  post_training: Record<string, unknown>;
};

export default function TrainingMetricsPanel({ role = "admin" }: { role?: "admin" | "viewer" }) {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/api/v1/admin/training/metrics")
      .then((res) => setData(res as MetricsResponse))
      .catch((err) => setError(err?.message || "failed to load metrics"));
  }, []);

  if (error) {
    throw new Error(error);
  }
  if (!data) {
    return <LoadingState />;
  }

  const renderSection = (title: string, obj: Record<string, unknown>) => (
    <div className="border rounded p-3 space-y-1">
      <div className="font-semibold text-sm">{title}</div>
      {Object.keys(obj).length === 0 ? (
        <div className="text-xs text-gray-600">لا توجد بيانات</div>
      ) : (
        <ul className="text-xs text-gray-800 space-y-1">
          {Object.entries(obj).map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span>{k}</span>
              <span>{String(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Training Metrics (Read-Only)</div>
        {role === "viewer" && (
          <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Read-Only</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderSection("Baseline", data.baseline || {})}
        {renderSection("Post-Training", data.post_training || {})}
      </div>
    </div>
  );
}
