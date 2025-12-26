import { useState, useEffect } from 'react';
import { apiAskQuestion } from '../api';
import { parseNDJSON } from '../utils/ndjson';
import DataTable from './DataTable';
import ChartView from './ChartView';
import SummaryView from './SummaryView';

interface DataRow {
  [key: string]: any;
}

interface ChartConfig {
  type: string;
  config: Record<string, any>;
}

interface SummaryResult {
  text: string;
}

interface StreamError {
  message: string;
}

export default function Chat() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataRows, setDataRows] = useState<DataRow[] | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<StreamError | null>(null);

  // Reset previous results
  const reset = () => {
    setDataRows(null);
    setChartConfig(null);
    setSummary(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    reset();
    setLoading(true);
    try {
      const response = await apiAskQuestion(question.trim(), null);
      if (!response.ok || !response.body) {
        const msg = await response.text();
        throw new Error(msg || 'Unknown error');
      }
      for await (const chunk of parseNDJSON(response)) {
        switch (chunk.phase) {
          case 'data':
            setDataRows(chunk.rows || []);
            break;
          case 'chart':
            setChartConfig({ type: chunk.type, config: chunk.config });
            break;
          case 'summary':
            setSummary({ text: chunk.text });
            break;
          case 'error':
            setError({ message: chunk.message || 'An error occurred' });
            break;
          default:
            console.warn('Unknown phase', chunk);
        }
      }
    } catch (err: any) {
      setError({ message: err.message || 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Ask Your Database</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Enter your question in Arabic or English"
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Loading...' : 'Ask'}
        </button>
      </form>
      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded">
          Error: {error.message}
        </div>
      )}
      {dataRows && (
        <div>
          <h2 className="text-xl font-semibold mt-6 mb-2">Data</h2>
          <DataTable rows={dataRows} />
        </div>
      )}
      {chartConfig && (
        <div>
          <h2 className="text-xl font-semibold mt-6 mb-2">Chart</h2>
          <ChartView type={chartConfig.type} config={chartConfig.config} rows={dataRows || []} />
        </div>
      )}
      {summary && (
        <div>
          <h2 className="text-xl font-semibold mt-6 mb-2">Summary</h2>
          <SummaryView text={summary.text} />
        </div>
      )}
    </div>
  );
}