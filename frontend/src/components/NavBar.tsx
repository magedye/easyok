import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AUTH_ENABLED, TOKEN_STORAGE_KEY } from '../config';

// Navigation bar with links to different pages. Shows login/logout depending
// on whether a token is stored. Links highlight when active.
export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const isAuthed = !AUTH_ENABLED || Boolean(token);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    navigate(AUTH_ENABLED ? '/login' : '/');
  };

  return (
    <nav className="navbar px-4 py-2 flex items-center justify-between" dir="rtl">
      <div className="flex items-center space-x-4 space-x-reverse">
        <span className="title text-blue-600 text-lg font-semibold">EasyData</span>
        {isAuthed && (
          <>
            <Link to="/" className={location.pathname === '/' ? 'font-bold' : ''}>
              الاستعلام
            </Link>
            <Link
              to="/training"
              className={location.pathname === '/training' ? 'font-bold' : ''}
            >
              التدريب
            </Link>
            <Link
              to="/console"
              className={location.pathname === '/console' ? 'font-bold' : ''}
            >
              العمليات
            </Link>
          </>
        )}
      </div>
      <div>
        {AUTH_ENABLED &&
          (token ? (
            <button onClick={handleLogout} className="btn bg-red-500 hover:bg-red-600">
              خروج
            </button>
          ) : (
            <Link to="/login" className="btn">
              دخول
            </Link>
          ))}
      </div>
    </nav>
  );
}
