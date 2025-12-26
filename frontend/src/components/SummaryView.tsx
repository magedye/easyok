// SummaryView renders the summary text returned by the backend.

export default function SummaryView({ text }: { text: string }) {
  return (
    <div className="p-4 border rounded bg-gray-50">
      <p>{text}</p>
    </div>
  );
}