import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK } from '../api';
import ErrorMessage from '../components/ErrorMessage';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form);
      navigate(location.state?.from || '/events', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>Log in</h1>
      {location.state?.registered && <div className="alert alert-success">Account created. You can log in now.</div>}
      <form onSubmit={onSubmit} className="form" noValidate>
        <label>
          Email
          <input type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <ErrorMessage error={error} />
        <button className="btn btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted small">No account? <Link to="/register">Sign up</Link></p>
      {USE_MOCK && (
        <p className="hint small">
          Mock accounts: <code>user@surgeseat.dev</code> / <code>user12345</code>, or{' '}
          <code>admin@surgeseat.dev</code> / <code>admin1234</code>
        </p>
      )}
    </div>
  );
}
