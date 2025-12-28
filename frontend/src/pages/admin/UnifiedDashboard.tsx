import AdminLayout from "../../layouts/AdminLayout";
import ObservabilityStatusBadges from "../../components/governance/ObservabilityStatusBadges";
import TelemetryPanel from "../../components/governance/TelemetryPanel";
import SentryIssuesPanel from "../../components/governance/SentryIssuesPanel";
import ProtectedRoute from "../../routing/ProtectedRoute";
import { ErrorBoundary } from "../../components/ErrorBoundary";

type Props = {
  role: "admin" | "viewer";
};

export default function UnifiedDashboard({ role }: Props) {
  return (
    <ProtectedRoute role={role}>
      <AdminLayout role={role}>
        <ErrorBoundary>
          <div className="space-y-6">
            <ObservabilityStatusBadges />
            <TelemetryPanel />
            <SentryIssuesPanel />
          </div>
        </ErrorBoundary>
      </AdminLayout>
    </ProtectedRoute>
  );
}
