import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Chat from './components/Chat';
import TrainingUpload from './components/TrainingUpload';
import Login from './components/Login';
import NavBar from './components/NavBar';

// App component defines application routes and top-level navigation.
// It checks for a stored JWT token on mount to optionally redirect to the chat page.
export default function App() {
  const navigate = useNavigate();
  useEffect(() => {
    // On first load, redirect to chat if already authenticated
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    } else {
      navigate('/login');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <NavBar />
      <div className="container mx-auto p-4">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/training" element={<TrainingUpload />} />
          <Route path="/" element={<Chat />} />
        </Routes>
      </div>
    </div>
  );
}