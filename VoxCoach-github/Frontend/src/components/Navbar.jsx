import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">
          <div className="brand-icon">
            <div className="brand-icon-bar" style={{ height: '40%' }}></div>
            <div className="brand-icon-bar" style={{ height: '80%' }}></div>
            <div className="brand-icon-bar" style={{ height: '60%' }}></div>
          </div>
          <span className="brand-wordmark">Vox<span>Coach</span></span>
        </Link>
      </div>
      <div className="navbar-menu">
        <button
          onClick={toggleTheme}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', padding: '0', background: 'transparent', cursor: 'pointer', border: '1.5px solid var(--ch-200)', color: 'var(--text-sub)' }}
          title="Toggle Theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/record">Record</Link>
            <span className="navbar-user">{user.username}</span>
            <button onClick={handleLogout} className="btn btn-outline btn-sm">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline btn-sm" style={{ border: 'none', padding: '8px 16px', background: 'transparent' }}>Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
