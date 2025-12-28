import { useState } from "react";

type Props = {
  feature: string;
  targetValue: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
};

export default function ToggleConfirmModal({ feature, targetValue, onConfirm, onCancel, loading }: Props) {
  const [reason, setReason] = useState("");
  const disabled = loading || reason.trim().length < 10;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md space-y-4">
        <div className="text-lg font-semibold">تأكيد التغيير</div>
        <p className="text-sm text-gray-700">
          سيتم تغيير {feature} إلى {String(targetValue)}. أدخل سبباً واضحاً (10 أحرف على الأقل).
        </p>
        <textarea
          className="w-full border border-gray-300 rounded p-2 text-sm"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب التغيير (10 أحرف على الأقل)"
        />
        <div className="flex justify-end space-x-2 space-x-reverse">
          <button
            className="px-3 py-1 rounded border border-gray-300"
            onClick={onCancel}
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white"
            onClick={() => onConfirm(reason)}
            disabled={disabled}
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}
