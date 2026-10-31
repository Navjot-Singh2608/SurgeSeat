import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK } from '../api';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">
          SurgeSeat
          {USE_MOCK && <span className="mock-tag" title="Using the in-browser mock API">mock</span>}
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/events">Events</NavLink>
          {user && <NavLink to="/reservations">My reservations</NavLink>}
          {isAdmin && <NavLink to="/admin/events/new">New event</NavLink>}
        </nav>
        <div className="nav-user">
          {user ? (
            <>
              <span className="muted small" title={user.role}>{user.email}</span>
              <button type="button" className="btn btn-small btn-ghost" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-small btn-ghost">Log in</NavLink>
              <NavLink to="/register" className="btn btn-small">Sign up</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
