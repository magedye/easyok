import { useState } from "react";
import { api } from "../../api/generated/client";
import { TrainingItem } from "./types";
import TrainingChecklist from "./TrainingChecklist";

type Props = {
  item: TrainingItem;
  onClose: () => void;
  onUpdated: () => void;
  role: "admin" | "viewer";
};

export default function TrainingReviewModal({ item, onClose, onUpdated, role }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const allChecked = Object.values(checks).length === 4 && Object.values(checks).every(Boolean);
  const reasonOk = reason.trim().length >= 10;
  const canAct = role === "admin" && allChecked && reasonOk && !loading;

  const act = async (action: "approve" | "reject") => {
    setLoading(true);
    try {
      if (action == "approve") {
        await api.post("/api/v1/admin/training/:id/approve", {
          params: { id: item.id },
          body: { reason },
        });
      } else {
        await api.post("/api/v1/admin/training/:id/reject", {
          params: { id: item.id },
          body: { reason },
        });
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-2xl space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-lg font-semibold">مراجعة العنصر التدريبي</div>
          <button className="text-sm text-gray-600" onClick={onClose} disabled={loading}>
            إغلاق
          </button>
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-500">السؤال</div>
            <div className="text-sm font-semibold">{item.question}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">الافتراضات</div>
            <div className="text-sm whitespace-pre-wrap">{item.assumptions || "غير متوفر"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">SQL (مقروء فقط)</div>
            <div className="text-sm whitespace-pre-wrap">{item.sql || "غير متوفر"}</div>
          </div>
          <div className="flex space-x-4 space-x-reverse text-xs text-gray-600">
            <span>Schema: {item.schema_version}</span>
            <span>Policy: {item.policy_version}</span>
          </div>
          <div className="border-t pt-3">
            <div className="text-sm font-semibold mb-2">قائمة التحقق (إلزامي)</div>
            <TrainingChecklist checks={checks} onChange={setChecks} />
          </div>
          <div className="border-t pt-3">
            <div className="text-sm font-semibold mb-1">سبب القرار (10 أحرف على الأقل)</div>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 space-x-reverse">
          <button
            className="px-3 py-1 rounded border border-gray-300"
            onClick={onClose}
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            className="px-3 py-1 rounded bg-red-600 text-white"
            onClick={() => act("reject")}
            disabled={!canAct}
          >
            رفض
          </button>
          <button
            className="px-3 py-1 rounded bg-green-600 text-white"
            onClick={() => act("approve")}
            disabled={!canAct}
          >
            موافقة
          </button>
        </div>
      </div>
    </div>
  );
}
