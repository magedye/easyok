import React, { useState } from "react";
import { API_BASE_URL } from "../config";

/**
 * Tier 2 Assistant page that targets /api/v2/vanna/agent.
 * Requires OPERATION_TIER=tier2_vanna on the backend.
 */
export default function Tier2AssistantPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callBackend = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v2/vanna/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Tier 2 Assistant</h2>
        <p className="text-sm text-gray-600 mb-4">
          Backend endpoint: <code>/api/v2/vanna/agent</code>. Enter a question to test the Tier 2
          pipeline directly. (Requires OPERATION_TIER=tier2_vanna on the backend.)
        </p>
        <div className="space-y-2">
          <textarea
            className="w-full rounded border p-2"
            rows={3}
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            onClick={callBackend}
            disabled={loading || !question.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Running..." : "Send to Tier 2"}
          </button>
        </div>
        {error && <div className="mt-3 rounded bg-red-100 p-2 text-red-700">{error}</div>}
        {result && (
          <div className="mt-3 rounded bg-gray-50 p-3 text-sm overflow-auto">
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
