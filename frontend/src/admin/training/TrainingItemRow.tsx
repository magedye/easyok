import { TrainingItem } from "./types";

type Props = {
  item: TrainingItem;
  onSelect?: (item: TrainingItem) => void;
  readOnly?: boolean;
};

export default function TrainingItemRow({ item, onSelect, readOnly }: Props) {
  return (
    <tr
      className={`border-t ${readOnly ? "" : "cursor-pointer hover:bg-gray-50"}`}
      onClick={() => {
        if (readOnly) return;
        onSelect && onSelect(item);
      }}
    >
      <td className="py-2">{item.question}</td>
      <td className="py-2">{item.schema_version}</td>
      <td className="py-2">{item.policy_version}</td>
      <td className="py-2">{item.created_by}</td>
      <td className="py-2">{item.status}</td>
      <td className="py-2">{item.created_at}</td>
    </tr>
  );
}
