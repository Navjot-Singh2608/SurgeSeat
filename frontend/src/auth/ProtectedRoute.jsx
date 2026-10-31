import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Spinner from '../components/Spinner';

// UI-level guard only. The backend must still enforce every role check;
// hiding a page is a convenience, not security.
export default function ProtectedRoute({ role }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    return (
      <div className="card narrow">
        <h1>Not allowed</h1>
        <p className="muted">This page needs the {role} role.</p>
      </div>
    );
  }
  return <Outlet />;
}
