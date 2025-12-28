import { useEffect, useState } from "react";
import { api } from "../../api/generated/client";
import LoadingState from "../../components/LoadingState";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import TrainingItemRow from "./TrainingItemRow";
import TrainingReviewModal from "./TrainingReviewModal";
import { TrainingItem } from "./types";
import AdminLayout from "../../layouts/AdminLayout";

type Props = {
  role: "admin" | "viewer";
};

const tabs: ("pending" | "approved" | "rejected")[] = ["pending", "approved", "rejected"];

export default function TrainingQueuePage({ role }: Props) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<TrainingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TrainingItem | null>(null);

  const load = () => {
    api
      .get("/api/v1/admin/training/items", { queries: { status } })
      .then((res) => setItems((res.items as TrainingItem[]) || []))
      .catch((err) => setError(err?.message || "failed to load items"));
  };

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const content = (() => {
    if (error) throw new Error(error);
    if (items === null) return <LoadingState />;
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center space-x-2 space-x-reverse">
          {tabs.map((t) => (
            <button
              key={t}
              className={`px-3 py-1 rounded ${status === t ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
              onClick={() => setStatus(t)}
            >
              {t}
            </button>
          ))}
          {role === "viewer" && (
            <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Read-Only</span>
          )}
        </div>
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="text-gray-600 border-b">
                <th className="py-2 px-3">السؤال</th>
                <th className="py-2 px-3">Schema</th>
                <th className="py-2 px-3">Policy</th>
                <th className="py-2 px-3">أنشأ بواسطة</th>
                <th className="py-2 px-3">الحالة</th>
                <th className="py-2 px-3">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TrainingItemRow
                  key={item.id}
                  item={item}
                  onSelect={setSelected}
                  readOnly={role !== "admin"}
                />
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="py-4 text-center text-gray-600" colSpan={6}>
                    لا توجد عناصر في هذا الصف.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  })();

  return (
    <ErrorBoundary>
      <AdminLayout role={role}>
        {content}
        {selected && role === "admin" && (
          <TrainingReviewModal
            item={selected}
            onClose={() => setSelected(null)}
            onUpdated={() => {
              setSelected(null);
              load();
            }}
            role={role}
          />
        )}
      </AdminLayout>
    </ErrorBoundary>
  );
}
