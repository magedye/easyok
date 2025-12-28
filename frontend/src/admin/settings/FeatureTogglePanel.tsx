import { useEffect, useState } from "react";
import { api } from "../../api/generated/client";
import { FeatureToggle } from "./types";
import FeatureToggleRow from "./FeatureToggleRow";
import ToggleConfirmModal from "./ToggleConfirmModal";
import LoadingState from "../../components/LoadingState";
import { ErrorBoundary } from "../../components/ErrorBoundary";

type Props = {
  role: "admin" | "viewer";
};

export default function FeatureTogglePanel({ role }: Props) {
  const [toggles, setToggles] = useState<FeatureToggle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalToggle, setModalToggle] = useState<FeatureToggle | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    api
      .get("/api/v1/admin/settings/feature-toggles")
      .then((res) => {
        // @ts-expect-error zod validated
        setToggles((res.features as FeatureToggle[]) || []);
      })
      .catch((err) => setError(err?.message || "failed to load toggles"));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRequestChange = (t: FeatureToggle) => {
    if (role !== "admin") return;
    setModalToggle(t);
  };

  const handleConfirm = (reason: string) => {
    if (!modalToggle) return;
    setLoading(true);
    api
      .post("/api/v1/admin/settings/feature-toggle", {
        feature: modalToggle.name,
        value: !modalToggle.value,
        reason,
      })
      .then(() => {
        setModalToggle(null);
        load();
      })
      .catch((err) => setError(err?.message || "toggle update failed"))
      .finally(() => setLoading(false));
  };

  if (error) {
    throw new Error(error);
  }
  if (toggles === null) {
    return <LoadingState />;
  }

  return (
    <ErrorBoundary>
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Feature Toggles</div>
            <div className="text-xs text-gray-600">التحكم محكوم عبر الخادم فقط</div>
          </div>
          {role === "viewer" && (
            <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Read-Only</span>
          )}
        </div>
        <div className="space-y-3">
          {toggles.map((t) => (
            <FeatureToggleRow
              key={t.name}
              toggle={t}
              onRequestChange={handleRequestChange}
              readOnly={role !== "admin"}
            />
          ))}
        </div>
      </div>
      {modalToggle && (
        <ToggleConfirmModal
          feature={modalToggle.name}
          targetValue={!modalToggle.value}
          onConfirm={handleConfirm}
          onCancel={() => setModalToggle(null)}
          loading={loading}
        />
      )}
    </ErrorBoundary>
  );
}
