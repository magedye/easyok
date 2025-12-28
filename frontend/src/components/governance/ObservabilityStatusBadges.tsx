import { useEffect, useState } from "react";
import { api } from "../../api/generated/client";
import LoadingState from "../LoadingState";

type Status = "enabled" | "disabled" | "noop" | "bypassed" | "muted";

const badgeColor: Record<Status, string> = {
  enabled: "bg-green-100 text-green-800 border-green-200",
  disabled: "bg-amber-100 text-amber-800 border-amber-200",
  noop: "bg-gray-100 text-gray-700 border-gray-200",
  bypassed: "bg-amber-100 text-amber-800 border-amber-200",
  muted: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function ObservabilityStatusBadges() {
  const [data, setData] = useState<{
    semantic_cache: Status;
    arabic_nlp: Status;
    alerts: Status;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/v1/admin/observability/status")
      .then(setData)
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "failed to load status");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    throw new Error(error);
  }
  if (!data) {
    return <LoadingState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" dir="rtl">
      <Badge label="Semantic Cache" value={data.semantic_cache} />
      <Badge label="Arabic NLP" value={data.arabic_nlp} />
      <Badge label="Alerts" value={data.alerts} />
    </div>
  );
}

function Badge({ label, value }: { label: string; value: Status }) {
  return (
    <div className={`flex items-center justify-between border rounded px-4 py-3 ${badgeColor[value]}`} dir="rtl">
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-bold capitalize">{value}</span>
    </div>
  );
}
