type Props = {
  checks: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
};

const fields = [
  "SQL correctness confirmed",
  "Generality (not overfitted)",
  "Assumptions explicit",
  "Schema/policy versions current",
];

export default function TrainingChecklist({ checks, onChange }: Props) {
  const toggle = (label: string) => {
    const next = { ...checks, [label]: !checks[label] };
    onChange(next);
  };
  return (
    <div className="space-y-2" dir="rtl">
      {fields.map((f) => (
        <label key={f} className="flex items-center space-x-2 space-x-reverse text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!checks[f]}
            onChange={() => toggle(f)}
          />
          <span>{f}</span>
        </label>
      ))}
    </div>
  );
}
