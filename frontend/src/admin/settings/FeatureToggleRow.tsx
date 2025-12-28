import { FeatureToggle } from "./types";

type Props = {
  toggle: FeatureToggle;
  onRequestChange?: (t: FeatureToggle) => void;
  readOnly?: boolean;
};

export default function FeatureToggleRow({ toggle, onRequestChange, readOnly }: Props) {
  const { name, value, mutable, last_changed_at, last_changed_by } = toggle;
  const disabled = readOnly || !mutable;

  return (
    <div className="flex items-center justify-between border border-gray-200 rounded px-4 py-3" dir="rtl">
      <div className="space-y-1">
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-gray-500">القيمة الحالية: {String(value)}</div>
        {last_changed_at && (
          <div className="text-xs text-gray-500">آخر تغيير: {last_changed_at}</div>
        )}
        {last_changed_by && (
          <div className="text-xs text-gray-500">بواسطة: {last_changed_by}</div>
        )}
        {!mutable && <div className="text-xs text-red-600">Immutable (security-critical)</div>}
      </div>
      <button
        className={`px-3 py-1 text-sm rounded ${
          disabled ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white"
        }`}
        disabled={disabled}
        onClick={() => onRequestChange && onRequestChange(toggle)}
      >
        تبديل
      </button>
    </div>
  );
}
