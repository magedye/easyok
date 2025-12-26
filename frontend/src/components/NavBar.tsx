import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken } from '../api';

// Navigation bar with links to different pages. Shows login/logout depending
// on whether a token is stored. Links highlight when active.
export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };
  return (
    <nav className="navbar px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-4">
          <span className="title text-blue-600 text-lg">EasyData</span>
          {token && (
            <>
              <Link to="/" className={location.pathname === '/' ? 'font-bold' : ''}>
                Ask
              </Link>
              <Link to="/training" className={location.pathname === '/training' ? 'font-bold' : ''}>
                Training
              </Link>
            </>
          )}
      </div>
      <div>
        {token ? (
          <button onClick={handleLogout} className="btn bg-red-500 hover:bg-red-600">
            Logout
          </button>
        ) : (
          <Link to="/login" className="btn">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}