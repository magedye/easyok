import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AUTH_ENABLED, TOKEN_STORAGE_KEY } from '../config';

// Simple login component that allows the user to paste a JWT token.
// AUTH is currently disabled; token is stored only for compatibility.
export default function Login() {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // When AUTH is disabled (MVP), /login is not used.
    if (!AUTH_ENABLED) {
      navigate('/', { replace: true });
    }
  }, [navigate, AUTH_ENABLED]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter a token');
      return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, tokenInput.trim());
    setError(null);
    navigate('/');
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label htmlFor="token">JWT Token</label>
          <textarea
            id="token"
            rows={4}
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste your JWT token here"
          />
        </div>
        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded">{error}</div>
        )}
        <button type="submit" className="btn">
          Save Token
        </button>
      </form>
    </div>
  );
}
