import { Routes, Route, Navigate } from 'react-router-dom';
import Chat from './components/Chat';
import TrainingUpload from './components/TrainingUpload';
import Login from './components/Login';
import NavBar from './components/NavBar';
import OperationalConsole from './components/OperationalConsole';

import { AUTH_ENABLED, TOKEN_STORAGE_KEY } from './config';

// App component defines application routes and top-level navigation.
export default function App() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const isAuthed = !AUTH_ENABLED || Boolean(token);

  return (
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
          <Route path="/" element={isAuthed ? <Chat /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
