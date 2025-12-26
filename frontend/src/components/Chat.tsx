import { useEffect, useState } from 'react';

import { useEasyStream } from '../api';
import type { AskChunk } from '../types/api';

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
  const [dataRows, setDataRows] = useState<DataRow[] | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<StreamError | null>(null);

  const { start, cancel, isStreaming } = useEasyStream();

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const reset = () => {
    setDataRows(null);
    setChartConfig(null);
    setSummary(null);
    setError(null);
  };

  const handleChunk = (chunk: AskChunk) => {
    switch (chunk.type) {
      case 'technical_view':
        // Intentionally ignored in MVP UI.
        break;
      case 'data':
        setDataRows(chunk.payload as DataRow[]);
        break;
      case 'chart':
        setChartConfig({ type: chunk.payload.chart_type, config: chunk.payload });
        break;
      case 'summary':
        setSummary({ text: chunk.payload });
        break;
      case 'error':
        setError({ message: chunk.payload.message || 'An error occurred' });
        break;
      default:
        // Exhaustiveness safeguard for forward-compatible chunk types.
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    reset();

    try {
      await start({ question: question.trim(), stream: true }, handleChunk);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({ message: msg || 'An error occurred' });
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
        <button type="submit" className="btn" disabled={isStreaming}>
          {isStreaming ? 'Loading...' : 'Ask'}
        </button>
      </form>
      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded">Error: {error.message}</div>
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
