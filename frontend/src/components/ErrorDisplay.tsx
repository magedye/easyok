import React, { useState } from 'react';
import { ErrorResponse, ErrorCode, formatError } from '../api/errorHandler';

/**
 * ErrorDisplay Component
 * 
 * Displays detailed error information with trace_id correlation for debugging
 * and user-friendly messaging based on the comprehensive error handling system.
 * 
 * Features:
 * - Trace ID correlation for backend debugging
 * - Error code categorization and user guidance  
 * - Copy error details for support
 * - Retry mechanism integration
 * - Accessibility compliance
 */

interface ErrorDisplayProps {
  error: ErrorResponse;
  traceId?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  canRetry?: boolean;
  retryAfterMs?: number;
  isRtl?: boolean;
}

interface RetryCountdown {
  remaining: number;
  total: number;
}

export default function ErrorDisplay({
  error,
  traceId,
  onRetry,
  onDismiss,
  canRetry = false,
  retryAfterMs,
  isRtl = false
}: ErrorDisplayProps) {
  const [countdown, setCountdown] = useState<RetryCountdown | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Start countdown if retry delay is specified
  React.useEffect(() => {
    if (retryAfterMs && retryAfterMs > 0) {
      const total = retryAfterMs;
      let remaining = total;
      
      setCountdown({ remaining: Math.ceil(remaining / 1000), total: Math.ceil(total / 1000) });
      
      const interval = setInterval(() => {
        remaining -= 1000;
        const remainingSeconds = Math.ceil(remaining / 1000);
        
        if (remainingSeconds > 0) {
          setCountdown({ remaining: remainingSeconds, total: Math.ceil(total / 1000) });
        } else {
          setCountdown(null);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [retryAfterMs]);

  /**
   * Copy error details to clipboard for support
   */
  const handleCopyError = async (): Promise<void> => {
    const errorDetails = {
      message: error.message,
      error_code: error.error_code,
      trace_id: error.trace_id || traceId,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href,
      details: error.details
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.warn('Failed to copy error details:', err);
    }
  };

  /**
   * Get error severity level for styling
   */
  const getErrorSeverity = (errorCode: string): 'error' | 'warning' | 'info' => {
    const criticalErrors = [
      ErrorCode.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      ErrorCode.TOKEN_EXPIRED,
      ErrorCode.POLICY_VIOLATION,
      ErrorCode.INTERNAL_SERVER_ERROR
    ];
    
    const warningErrors = [
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.QUOTA_EXCEEDED,
      ErrorCode.QUERY_TIMEOUT,
      ErrorCode.VALIDATION_ERROR
    ];

    if (criticalErrors.includes(errorCode as ErrorCode)) return 'error';
    if (warningErrors.includes(errorCode as ErrorCode)) return 'warning';
    return 'info';
  };

  /**
   * Get error icon based on severity
   */
  const getErrorIcon = (severity: string): JSX.Element => {
    switch (severity) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  /**
   * Get user guidance based on error code
   */
  const getUserGuidance = (errorCode: string): string => {
    switch (errorCode as ErrorCode) {
      case ErrorCode.INVALID_CREDENTIALS:
        return isRtl ? 'تحقق من بيانات الدخول وحاول مرة أخرى' : 'Check your credentials and try again';
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return isRtl ? 'انتظر قليلاً قبل إرسال طلب جديد' : 'Please wait before sending another request';
      case ErrorCode.POLICY_VIOLATION:
        return isRtl ? 'راجع الجداول المسموحة وأعد صياغة السؤال' : 'Review allowed tables and rephrase your question';
      case ErrorCode.QUERY_TIMEOUT:
        return isRtl ? 'جرب سؤالاً أبسط أو أكثر تحديداً' : 'Try a simpler or more specific question';
      case ErrorCode.CONTEXT_TOO_LARGE:
        return isRtl ? 'قسّم السؤال إلى أجزاء أصغر' : 'Break down your question into smaller parts';
      default:
        return isRtl ? 'تحقق من اتصال الإنترنت وحاول مرة أخرى' : 'Check your internet connection and try again';
    }
  };

  const severity = getErrorSeverity(error.error_code);
  const correlationId = error.trace_id || traceId;

  // Styling based on severity
  const severityStyles = {
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: 'text-red-600',
      button: 'text-red-700 hover:text-red-900 hover:bg-red-100'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: 'text-yellow-600', 
      button: 'text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100'
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: 'text-blue-600',
      button: 'text-blue-700 hover:text-blue-900 hover:bg-blue-100'
    }
  };

  const styles = severityStyles[severity];

  return (
    <div 
      className={`rounded-lg border p-4 space-y-4 ${styles.container}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      role="alert"
      aria-live="assertive"
    >
      {/* Error Header */}
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {getErrorIcon(severity)}
        </div>
        
        <div className="flex-1 space-y-2">
          {/* Error Message */}
          <h3 className="text-sm font-semibold">
            {formatError(error, false)}
          </h3>
          
          {/* User Guidance */}
          <p className="text-sm opacity-90">
            {getUserGuidance(error.error_code)}
          </p>

          {/* Error Metadata */}
          <div className="flex flex-wrap gap-4 text-xs opacity-75">
            {error.error_code && (
              <span>
                <strong>{isRtl ? 'رمز الخطأ:' : 'Code:'}</strong> {error.error_code}
              </span>
            )}
            
            {correlationId && (
              <span>
                <strong>{isRtl ? 'معرف التتبع:' : 'Trace ID:'}</strong> {correlationId.substring(0, 12)}...
              </span>
            )}
            
            <span>
              <strong>{isRtl ? 'الوقت:' : 'Time:'}</strong> {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 p-1 rounded-md ${styles.button} transition-colors`}
            aria-label={isRtl ? 'إخفاء الخطأ' : 'Dismiss error'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Retry Section */}
      {(canRetry || onRetry) && (
        <div className="flex items-center gap-3">
          {countdown ? (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span>
                {isRtl 
                  ? `إعادة المحاولة خلال ${countdown.remaining} ثانية`
                  : `Retry in ${countdown.remaining}s`
                }
              </span>
            </div>
          ) : (
            onRetry && (
              <button
                onClick={onRetry}
                className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md ${styles.button} transition-colors`}
                disabled={!!countdown}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRtl ? 'المحاولة مرة أخرى' : 'Retry'}
              </button>
            )
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-current border-opacity-20">
        {/* Copy Error Details */}
        <button
          onClick={handleCopyError}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${styles.button} rounded transition-colors`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copySuccess 
            ? (isRtl ? 'تم النسخ!' : 'Copied!')
            : (isRtl ? 'نسخ تفاصيل الخطأ' : 'Copy Details')
          }
        </button>

        {/* Support Link */}
        {correlationId && (
          <a
            href={`mailto:support@example.com?subject=Error Report&body=Trace ID: ${correlationId}%0AError: ${encodeURIComponent(error.message)}`}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${styles.button} rounded transition-colors`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {isRtl ? 'الدعم الفني' : 'Contact Support'}
          </a>
        )}
      </div>

      {/* Technical Details (for development) */}
      {error.details && process.env.NODE_ENV === 'development' && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium opacity-75">
            {isRtl ? 'التفاصيل التقنية' : 'Technical Details'}
          </summary>
          <pre className="mt-2 text-xs bg-white bg-opacity-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(error.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}