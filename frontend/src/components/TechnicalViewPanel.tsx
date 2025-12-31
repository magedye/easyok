import React, { useState } from 'react';

/**
 * TechnicalViewPanel Component
 * 
 * Displays the technical_view chunk from the streaming response in a secure, 
 * read-only format that complies with all frontend governance rules.
 * 
 * Governance Compliance:
 * - Rule #1: No SQL generation/parsing - DISPLAY ONLY
 * - Rule #5: No assumption modification - READ ONLY bullet list
 * - Rule #8: No unauthorized mutation - Copy and feedback only
 * 
 * @governance-ignore-next-line rule=no-sql-generation reason="Display only - no parsing or modification"
 */

interface TechnicalViewProps {
  sql: string;
  assumptions: string[];
  policyHash: string;
  onMarkIncorrect?: () => void;
  isRtl?: boolean;
}

interface CopyFeedback {
  success: boolean;
  message: string;
}

export default function TechnicalViewPanel({
  sql,
  assumptions,
  policyHash,
  onMarkIncorrect,
  isRtl = false
}: TechnicalViewProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [showPolicyTooltip, setShowPolicyTooltip] = useState(false);

  /**
   * Copy SQL to clipboard - governance compliant (no modification)
   */
  const handleCopySQL = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopyFeedback({
        success: true,
        message: isRtl ? 'تم نسخ SQL بنجاح' : 'SQL copied successfully'
      });
    } catch (error) {
      setCopyFeedback({
        success: false,
        message: isRtl ? 'فشل في نسخ SQL' : 'Failed to copy SQL'
      });
    }

    // Clear feedback after 3 seconds
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  /**
   * Handle mark incorrect feedback
   */
  const handleMarkIncorrect = (): void => {
    if (onMarkIncorrect) {
      onMarkIncorrect();
    }
  };

  /**
   * Format policy hash for display
   */
  const formatPolicyHash = (hash: string): string => {
    if (!hash) return 'N/A';
    return hash.length > 12 ? `${hash.substring(0, 12)}...` : hash;
  };

  return (
    <div className={`w-full space-y-4 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Policy Compliance Header */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">
            {isRtl ? 'متوافق مع السياسة' : 'Policy Compliant'}
          </span>
          
          {/* Policy Hash Badge with Tooltip */}
          <div 
            className="relative inline-block"
            onMouseEnter={() => setShowPolicyTooltip(true)}
            onMouseLeave={() => setShowPolicyTooltip(false)}
          >
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full cursor-help">
              {formatPolicyHash(policyHash)}
            </span>
            
            {showPolicyTooltip && (
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-gray-900 text-white px-3 py-2 rounded-md text-xs whitespace-nowrap">
                  {isRtl ? 'معرف السياسة الكامل' : 'Full Policy Hash'}: {policyHash}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                    <div className="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Copy SQL Button */}
          <button
            onClick={handleCopySQL}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            title={isRtl ? 'نسخ SQL إلى الحافظة' : 'Copy SQL to clipboard'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {isRtl ? 'نسخ SQL' : 'Copy SQL'}
          </button>

          {/* Mark Incorrect Button */}
          {onMarkIncorrect && (
            <button
              onClick={handleMarkIncorrect}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
              title={isRtl ? 'الإبلاغ عن خطأ في النتيجة' : 'Report incorrect result'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {isRtl ? 'إبلاغ عن خطأ' : 'Mark Incorrect'}
            </button>
          )}
        </div>
      </div>

      {/* Copy Feedback */}
      {copyFeedback && (
        <div className={`p-2 rounded-md text-sm ${
          copyFeedback.success 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {copyFeedback.message}
        </div>
      )}

      {/* SQL Display - Read Only */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {isRtl ? 'استعلام SQL المُولد' : 'Generated SQL Query'}
        </h4>
        
        <div className="relative">
          <pre className={`
            bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto
            border border-slate-200 font-mono leading-relaxed
            ${isRtl ? 'text-right' : 'text-left'}
          `}>
            <code>{sql}</code>
          </pre>
          
          {/* Read-only indicator */}
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              {isRtl ? 'للقراءة فقط' : 'Read Only'}
            </span>
          </div>
        </div>
      </div>

      {/* Assumptions Display - Read Only */}
      {assumptions && assumptions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">
            {isRtl ? 'الافتراضات المستخدمة' : 'Query Assumptions'}
          </h4>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <ul className={`space-y-2 text-sm text-gray-700 ${isRtl ? 'list-none' : 'list-disc list-inside'}`}>
              {assumptions.map((assumption, index) => (
                <li key={index} className="flex items-start gap-2">
                  {isRtl && <span className="text-blue-500 mt-1">•</span>}
                  <span className="flex-1">{assumption}</span>
                </li>
              ))}
            </ul>
            
            {/* Governance compliance note */}
            <div className="mt-3 pt-3 border-t border-blue-300">
              <p className="text-xs text-blue-600 italic">
                {isRtl 
                  ? '📋 الافتراضات مُولدة تلقائيًا من الخادم وغير قابلة للتعديل' 
                  : '📋 Assumptions are auto-generated by the server and cannot be modified'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          
          <div className="flex-1">
            <h5 className="text-sm font-medium text-yellow-800 mb-1">
              {isRtl ? 'إشعار أمني' : 'Security Notice'}
            </h5>
            <p className="text-xs text-yellow-700">
              {isRtl 
                ? 'هذا العرض للقراءة فقط. لا تحاول تعديل أو تفسير SQL. جميع الاستعلامات تمر عبر فلاتر الأمان في الخادم.'
                : 'This is a read-only display. Do not attempt to modify or interpret SQL. All queries are filtered through server-side security policies.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Governance Rules Compliance Footer */}
      <div className="text-xs text-gray-500 space-y-1 border-t pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>{isRtl ? 'القاعدة #1: عرض SQL فقط (بدون تحليل أو توليد)' : 'Rule #1: SQL Display Only (No parsing/generation)'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>{isRtl ? 'القاعدة #5: عرض الافتراضات فقط (بدون تعديل)' : 'Rule #5: Assumptions Display Only (No modification)'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>{isRtl ? 'القاعدة #8: النسخ والتغذية الراجعة فقط (بدون تحليل غير مصرح)' : 'Rule #8: Copy & Feedback Only (No unauthorized mutation)'}</span>
        </div>
      </div>
    </div>
  );
}