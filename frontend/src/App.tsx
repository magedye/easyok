import { Routes, Route, Navigate } from 'react-router-dom';
import Chat from './components/Chat';
import TrainingUpload from './components/TrainingUpload';
import Login from './components/Login';
import NavBar from './components/NavBar';
import OperationalConsole from './components/OperationalConsole';
import UnifiedDashboard from './pages/Admin/UnifiedDashboard';
import TrainingQueuePage from './admin/training/TrainingQueuePage';
import TrainingMetricsPanel from './admin/training/TrainingMetricsPanel';
import Tier2AssistantPage from './pages/Tier2AssistantPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import AdminLayout from './layouts/AdminLayout';

import { AUTH_ENABLED, TOKEN_STORAGE_KEY } from './config';

// App component defines application routes and top-level navigation.
export default function App() {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const isAuthed = !AUTH_ENABLED || Boolean(token);
  const role: 'admin' | 'viewer' =
    (window as any).__USER?.role === 'admin'
      ? 'admin'
      : 'viewer';

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <NavBar />
        <div className="container mx-auto p-4">
          <Routes>
            <Route
              path="/login"
              element={
                AUTH_ENABLED ? (
                  token ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Login />
                  )
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/training"
              element={isAuthed ? <TrainingUpload /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/console"
              element={isAuthed ? <OperationalConsole /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin/dashboard"
              element={isAuthed ? <UnifiedDashboard role={role} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin"
              element={isAuthed ? <UnifiedDashboard role={role} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/tier2-assistant"
              element={isAuthed ? <Tier2AssistantPage /> : <Navigate to="/login" replace />}
            />
            <Route path="/" element={isAuthed ? <Chat /> : <Navigate to="/login" replace />} />
            <Route
              path="/admin/training/queue"
              element={isAuthed ? <TrainingQueuePage role={role} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin/training/metrics"
              element={
                isAuthed ? (
                  <AdminLayout role={role}>
                    <TrainingMetricsPanel role={role} />
                  </AdminLayout>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ErrorBoundary>
  );
}
