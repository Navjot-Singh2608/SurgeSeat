import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const mismatch = form.confirm && form.password !== form.confirm;
  const fields = error?.fields || {};

  async function onSubmit(e) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await register({ email: form.email, password: form.password });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>Create an account</h1>
      <form onSubmit={onSubmit} className="form" noValidate>
        <label>
          Email
          <input type="email" autoComplete="email" required value={form.email}
            aria-invalid={!!fields.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {fields.email && <span className="field-error">{fields.email}</span>}
        </label>
        <label>
          Password
          <input type="password" autoComplete="new-password" required minLength={8} value={form.password}
            aria-invalid={!!fields.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <span className={fields.password ? 'field-error' : 'muted small'}>{fields.password || 'At least 8 characters.'}</span>
        </label>
        <label>
          Confirm password
          <input type="password" autoComplete="new-password" required value={form.confirm}
            aria-invalid={mismatch} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          {mismatch && <span className="field-error">Passwords do not match.</span>}
        </label>
        <ErrorMessage error={error && !error.fields ? error : null} />
        <button className="btn btn-block" disabled={busy || mismatch}>{busy ? 'Creating…' : 'Sign up'}</button>
      </form>
      <p className="muted small">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
