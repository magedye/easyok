import { SIGNOZ_DASHBOARD_URL } from "../../config";

export default function TelemetryPanel() {
  const url = SIGNOZ_DASHBOARD_URL;
  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 space-y-2" dir="rtl">
      <div className="text-lg font-semibold">Telemetry (SigNoz)</div>
      {url ? (
        <iframe
          title="SigNoz"
          src={url}
          className="w-full h-[400px] border rounded"
          allow="fullscreen"
        />
      ) : (
        <div className="text-sm text-gray-600">SigNoz dashboard URL غير مضبوط.</div>
      )}
    </div>
  );
}
