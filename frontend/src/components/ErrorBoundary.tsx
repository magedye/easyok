import React from "react";

type State = { hasError: boolean; message?: string };
type Props = { children: React.ReactNode };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Governance UI error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 text-red-800 border border-red-200 rounded" dir="rtl">
          <div className="font-semibold mb-2">حدث خطأ</div>
          <div className="text-sm">{this.state.message || "خطأ غير متوقع"}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
