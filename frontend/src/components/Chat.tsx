import { useEffect, useState } from 'react';

import { useEasyStream } from '../api';
import type { AskChunk, SummaryPayload } from '../types/api';
import { useRunHistory } from '../hooks/useRunHistory';

import AssumptionsPanel from './AssumptionsPanel';
import DataTable from './DataTable';
import ChartView from './ChartView';
import SummaryView from './SummaryView';
import { Panel } from './UiPrimitives';

interface DataRow {
  [key: string]: any;
}

interface ChartConfig {
  type: string;
  config: Record<string, any>;
}

interface StreamError {
  message: string;
}

export default function Chat() {
  const [question, setQuestion] = useState('');
  const [dataRows, setDataRows] = useState<DataRow[] | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [technicalView, setTechnicalView] = useState<any | null>(null);
  const isRtl = true;

  const { addEntry } = useRunHistory();

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
    setTechnicalView(null);
  };

  const handleChunk = (chunk: AskChunk) => {
    switch (chunk.type) {
      case 'technical_view':
        setTechnicalView(chunk.payload);
        break;
      case 'data': {
        const payload = chunk.payload as any;
        const rows = Array.isArray(payload) ? payload : payload.rows || [];
        setDataRows(rows);
        break;
      }
      case 'chart':
        setChartConfig({ type: (chunk.payload as any).chart_type, config: chunk.payload as any });
        break;
      case 'summary':
        setSummary(chunk.payload);
        addEntry({
          id: `${Date.now()}`,
          question: question.trim(),
          technicalView,
          summary: chunk.payload,
          timestamp: Date.now(),
          status: 'success'
        });
        break;
      case 'error':
        setError({ message: (chunk.payload as any).message || 'An error occurred' });
        addEntry({
          id: `${Date.now()}`,
          question: question.trim(),
          technicalView,
          summary: chunk.payload.message,
          timestamp: Date.now(),
          status: 'failed'
        });
        break;
      default:
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
    <div className="space-y-6" dir="rtl">
      <Panel
        title="لوحة الاستعلام المحكّمة"
        description="أرسل سؤالاً وشاهد المسار المحكوم (عرض تقني، بيانات، رسم، ملخص) دون أي منطق في الواجهة."
        isRtl={isRtl}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="question" className="text-sm font-medium text-gray-800">
            السؤال
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full border rounded p-2 text-sm"
            placeholder="اكتب السؤال بالعربية أو الإنجليزية"
          />
          <button type="submit" className="btn" disabled={isStreaming}>
            {isStreaming ? 'جاري المعالجة...' : 'اسأل'}
          </button>
        </form>
      </Panel>

      {technicalView && (
        <Panel
          title="العرض التقني (من الخادم)"
          description="SQL والافتراضات مشتقة من الـ DDL، فقط للعرض."
          isRtl={isRtl}
        >
          <pre className="bg-blue-50 border border-blue-200 rounded p-3 text-xs overflow-auto">
            {technicalView.sql}
          </pre>
          <AssumptionsPanel technicalView={technicalView} />
        </Panel>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded" dir="rtl">
          خطأ: {error.message}
        </div>
      )}
      {dataRows && (
        <Panel title="البيانات" description="البيانات كما أرسلها الخادم." isRtl={isRtl}>
          <DataTable rows={dataRows} />
        </Panel>
      )}
      {chartConfig && (
        <Panel title="الرسم البياني" description="تكوين الرسم من الخادم." isRtl={isRtl}>
          <ChartView type={chartConfig.type} config={chartConfig.config} rows={dataRows || []} />
        </Panel>
      )}
      {summary && (
        <Panel title="الملخص" description="ملخص عربي من الخادم." isRtl={isRtl}>
          <SummaryView text={typeof summary === 'string' ? summary : (summary as any).text} />
        </Panel>
      )}
    </div>
  );
}
