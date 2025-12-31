import React, { useEffect, useState, useRef } from 'react';

import { useEasyStream } from '../api';
import type { AskChunk, SummaryPayload } from '../types/api';
import { ChunkType, StreamChunk } from '../types/streaming';
import { StreamValidator } from '../utils/streamingValidator';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { useRunHistory } from '../hooks/useRunHistory';

// import AssumptionsPanel from './AssumptionsPanel'; // Commented out due to module issues
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
  trace_id?: string;
  error_code?: string;
}

interface StreamProgress {
  phase: ChunkType | null;
  chunksReceived: number;
  isValidating: boolean;
  expectedNext: ChunkType[];
}

export default function Chat() {
  const [question, setQuestion] = useState('');
  const [dataRows, setDataRows] = useState<DataRow[] | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [technicalView, setTechnicalView] = useState<any | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [progress, setProgress] = useState<StreamProgress>({
    phase: null,
    chunksReceived: 0,
    isValidating: false,
    expectedNext: []
  });
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string | null>(null);
  
  const isRtl = true;
  const validatorRef = useRef<StreamValidator>(new StreamValidator());
  const currentTraceId = useRef<string | null>(null);

  // Feature flags
  const enableAdvancedLogging = useFeatureFlag('ENABLE_OBSERVABILITY');
  const enableTrainingFeatures = useFeatureFlag('ENABLE_TRAINING_PILOT');
  const enableCaching = useFeatureFlag('ENABLE_SEMANTIC_CACHE');

  const { addEntry } = useRunHistory();
  const { start, cancel, isStreaming } = useEasyStream();

  useEffect(() => {
    return () => {
      cancel();
      validatorRef.current.reset();
    };
  }, [cancel]);

  const reset = () => {
    setDataRows(null);
    setChartConfig(null);
    setSummary(null);
    setError(null);
    setTechnicalView(null);
    setThinking(null);
    setProgress({
      phase: null,
      chunksReceived: 0,
      isValidating: false,
      expectedNext: []
    });
    setLastAskedQuestion(null);
    validatorRef.current.reset();
    currentTraceId.current = null;
  };

  /**
   * Enhanced chunk handler with ChunkType enum validation and trace ID correlation
   */
  const handleChunk = (chunk: AskChunk) => {
    // Convert legacy chunk to new format for validation
    const chunkType = mapLegacyTypeToChunkType(chunk.type);
    const traceId = chunk.trace_id || currentTraceId.current || `trace_${Date.now()}`;
    
    // Create StreamChunk for validation
    const streamChunk: StreamChunk = {
      type: chunkType,
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      payload: chunk.payload
    } as StreamChunk;

    // Validate chunk order using StreamValidator
    setProgress(prev => ({ ...prev, isValidating: true }));
    const validation = validatorRef.current.validateChunkOrder(streamChunk);
    
    if (!validation.valid) {
      const errorMsg = `Stream validation failed: ${validation.error}`;
      console.error('[Chat] Chunk validation error:', {
        error: errorMsg,
        chunk: streamChunk,
        traceId,
        expectedNext: validation.expectedNext
      });
      
      if (enableAdvancedLogging) {
        // Log validation error for governance compliance
        setError({
          message: errorMsg,
          trace_id: traceId,
          error_code: 'CHUNK_ORDER_VIOLATION'
        });
        return;
      }
    }

    // Update progress
    const expectedNext = validatorRef.current.getExpectedNextChunks();
    setProgress({
      phase: chunkType,
      chunksReceived: validatorRef.current.getChunks().length,
      isValidating: false,
      expectedNext
    });

    // Store trace ID from first chunk
    if (!currentTraceId.current) {
      currentTraceId.current = traceId;
    }

    // Process chunk by type using ChunkType enum
    switch (chunkType) {
      case ChunkType.THINKING:
        handleThinkingChunk(chunk.payload);
        break;
        
      case ChunkType.TECHNICAL_VIEW:
        handleTechnicalViewChunk(chunk.payload);
        break;
        
      case ChunkType.DATA:
        handleDataChunk(chunk.payload);
        break;
        
      case ChunkType.BUSINESS_VIEW:
        handleBusinessViewChunk(chunk.payload);
        break;
        
      case ChunkType.ERROR:
        handleErrorChunk(chunk.payload, traceId);
        break;
        
      case ChunkType.END:
        handleEndChunk();
        break;
        
      default:
        console.warn('[Chat] Unexpected chunk type:', chunkType, chunk);
        break;
    }
  };

  /**
   * Handle thinking chunk - new in enhanced protocol
   */
  const handleThinkingChunk = (payload: any) => {
    const content = typeof payload === 'string' ? payload : payload?.content || 'Processing your question...';
    setThinking(content);
    
    if (enableAdvancedLogging) {
      console.debug('[Chat] Thinking phase:', content);
    }
  };

  /**
   * Handle technical view chunk with enhanced logging
   */
  const handleTechnicalViewChunk = (payload: any) => {
    setTechnicalView(payload);
    
    if (enableAdvancedLogging) {
      console.debug('[Chat] Technical view received:', {
        sql: payload?.sql?.substring(0, 100) + '...',
        assumptionsCount: payload?.assumptions?.length || 0,
        isSafe: payload?.is_safe,
        traceId: currentTraceId.current
      });
    }
  };

  /**
   * Handle data chunk with validation
   */
  const handleDataChunk = (payload: any) => {
    const rows = Array.isArray(payload) ? payload : payload?.rows || [];
    setDataRows(rows);
    
    if (enableAdvancedLogging) {
      console.debug('[Chat] Data chunk received:', {
        rowCount: rows.length,
        columns: payload?.columns?.length || 0,
        traceId: currentTraceId.current
      });
    }
  };

  /**
   * Handle business view chunk (maps to summary in legacy UI)
   */
  const handleBusinessViewChunk = (payload: any) => {
    setSummary(payload);
    
    // Add to run history on successful completion
    addEntry({
      id: currentTraceId.current || `${Date.now()}`,
      question: question.trim(),
      technicalView,
      summary: payload,
      timestamp: Date.now(),
      status: 'success'
    });

    if (enableAdvancedLogging) {
      console.debug('[Chat] Business view completed:', {
        traceId: currentTraceId.current,
        hasMetrics: !!payload?.metrics,
        hasChart: !!payload?.chart
      });
    }
  };

  /**
   * Handle error chunk with trace correlation
   */
  const handleErrorChunk = (payload: any, traceId: string) => {
    const errorData = {
      message: payload?.message || 'An error occurred',
      trace_id: traceId,
      error_code: payload?.error_code
    };
    
    setError(errorData);
    
    // Add error to run history
    addEntry({
      id: traceId,
      question: question.trim(),
      technicalView,
      summary: errorData.message,
      timestamp: Date.now(),
      status: 'failed'
    });

    console.error('[Chat] Error chunk received:', errorData);
  };

  /**
   * Handle end chunk - validate stream completion
   */
  const handleEndChunk = () => {
    const completionValidation = validatorRef.current.validateStreamCompletion();
    
    if (!completionValidation.valid && enableAdvancedLogging) {
      console.warn('[Chat] Stream completion validation failed:', completionValidation.error);
    }

    const streamStats = validatorRef.current.getStreamStats();
    
    if (enableAdvancedLogging) {
      console.debug('[Chat] Stream completed:', {
        ...streamStats,
        traceId: currentTraceId.current
      });
    }
    
    // Clear thinking state as we're done
    setThinking(null);
  };

  /**
   * Map legacy chunk type strings to ChunkType enum
   */
  const mapLegacyTypeToChunkType = (legacyType: string): ChunkType => {
    switch (legacyType) {
      case 'thinking': return ChunkType.THINKING;
      case 'technical_view': return ChunkType.TECHNICAL_VIEW;
      case 'data': return ChunkType.DATA;
      case 'chart': return ChunkType.DATA; // Chart is part of data in new protocol
      case 'summary': return ChunkType.BUSINESS_VIEW;
      case 'error': return ChunkType.ERROR;
      case 'end': return ChunkType.END;
      default: return ChunkType.THINKING; // Default fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    reset();

    try {
      await start({ question: question.trim(), stream: true }, handleChunk);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      setError({
        message: errorMessage || 'An error occurred',
        trace_id: currentTraceId.current || undefined
      });
      
      console.error('[Chat] Request failed:', {
        error: errorMessage,
        question: question.trim(),
        traceId: currentTraceId.current
      });
    }
  };

  /**
   * Get user-friendly phase display name
   */
  const getPhaseDisplayName = (phase: ChunkType | null): string => {
    if (!phase) return 'غير محدد';
    
    switch (phase) {
      case ChunkType.THINKING: return 'التفكير';
      case ChunkType.TECHNICAL_VIEW: return 'العرض التقني';
      case ChunkType.DATA: return 'البيانات';
      case ChunkType.BUSINESS_VIEW: return 'الملخص';
      case ChunkType.ERROR: return 'خطأ';
      case ChunkType.END: return 'اكتمل';
      default: return phase;
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
          
          <div className="flex justify-between items-center">
            <button type="submit" className="btn" disabled={isStreaming}>
              {isStreaming ? 'جاري المعالجة...' : 'اسأل'}
            </button>
            
            {enableAdvancedLogging && currentTraceId.current && (
              <span className="text-xs text-gray-500">
                Trace: {currentTraceId.current.substring(0, 8)}...
              </span>
            )}
          </div>

          {/* Enhanced streaming progress indicator */}
          {isStreaming && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex justify-between text-sm">
                <span>المرحلة الحالية: {getPhaseDisplayName(progress.phase)}</span>
                <span>الأجزاء المستلمة: {progress.chunksReceived}</span>
              </div>
              
              {progress.expectedNext.length > 0 && enableAdvancedLogging && (
                <div className="text-xs text-gray-600 mt-1">
                  التالي المتوقع: {progress.expectedNext.map(getPhaseDisplayName).join(', ')}
                </div>
              )}
              
              {progress.isValidating && (
                <div className="text-xs text-yellow-600 mt-1">
                  🔍 جاري التحقق من ترتيب البيانات...
                </div>
              )}
            </div>
          )}

          {/* Cache notice if enabled */}
          {enableCaching && (
            <div className="text-xs text-blue-600 mt-2">
              ℹ️ التخزين المؤقت الدلالي مُفعّل - قد تكون النتائج محفوظة
            </div>
          )}
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
          
          {/* Enhanced assumptions display */}
          {technicalView.assumptions && technicalView.assumptions.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-2">الافتراضات:</h4>
              <ul className="text-sm space-y-1">
                {technicalView.assumptions.map((assumption: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{assumption}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Policy compliance indicator */}
          {technicalView.policy_hash && enableAdvancedLogging && (
            <div className="mt-2 text-xs text-green-600">
              ✅ متوافق مع السياسة: {technicalView.policy_hash.substring(0, 12)}...
            </div>
          )}
          
          {/* Training feedback option if enabled */}
          {enableTrainingFeatures && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button className="text-xs text-blue-600 hover:text-blue-800">
                🏷️ تحسين هذه النتيجة (التدريب)
              </button>
            </div>
          )}
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
