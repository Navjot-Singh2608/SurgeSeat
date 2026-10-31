import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import { formatDateTime, formatPrice } from '../utils/format';
import { uuid } from '../utils/uuid';

const MAX_QTY = 6;

// Errors where the request may or may not have reached the database.
// Retrying them must reuse the SAME Idempotency-Key so the backend can de-duplicate.
const isAmbiguous = (err) => err.isNetwork || err.status >= 500;

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [event, setEvent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tierId, setTierId] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  // One key per logical reservation attempt, not per click.
  const idemKey = useRef(uuid());
  const newAttempt = () => {
    idemKey.current = uuid();
  };

  const load = useCallback(() => {
    setLoadError(null);
    api.getEvent(id)
      .then((e) => {
        setEvent(e);
        setTierId((cur) => cur ?? e.tiers.find((t) => t.available > 0)?.id ?? null);
      })
      .catch(setLoadError);
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function chooseTier(tid) {
    setTierId(tid);
    setQty(1);
    setError(null);
    newAttempt();
  }

  function chooseQty(n) {
    setQty(n);
    setError(null);
    newAttempt();
  }

  async function reserve() {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { tierId, qty, idempotencyKey: idemKey.current };

    try {
      let reservation;
      try {
        reservation = await api.createReservation(payload);
      } catch (err) {
        if (!err.isNetwork) throw err;
        // One automatic retry after a network blip, with the same key: safe by design.
        await new Promise((r) => setTimeout(r, 800));
        reservation = await api.createReservation(payload);
      }
      newAttempt();
      navigate(`/reservations/${reservation.id}`);
    } catch (err) {
      setError(err);
      if (err.code === 'RATE_LIMITED') setCooldown(err.retryAfter || 5);
      if (!isAmbiguous(err) && err.code !== 'RATE_LIMITED') newAttempt();
      if (err.code === 'SOLD_OUT') load(); // refresh availability
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorMessage error={loadError} onRetry={load} />;
  if (!event) return <Spinner label="Loading event" />;

  const tier = event.tiers.find((t) => t.id === tierId);
  const maxQty = tier ? Math.min(MAX_QTY, tier.available) : 1;

  return (
    <section className="detail">
      <Link to="/events" className="muted small">← All events</Link>
      <h1>{event.name}</h1>
      <p className="muted">{formatDateTime(event.starts_at)} · {event.venue}</p>
      {event.description && <p>{event.description}</p>}

      <div className="card">
        <h2>Choose tickets</h2>
        <div className="tiers" role="radiogroup" aria-label="Ticket tier">
          {event.tiers.map((t) => {
            const soldOut = t.available === 0;
            return (
              <label key={t.id} className={`tier ${tierId === t.id ? 'selected' : ''} ${soldOut ? 'disabled' : ''}`}>
                <input type="radio" name="tier" value={t.id} checked={tierId === t.id} disabled={soldOut}
                  onChange={() => chooseTier(t.id)} />
                <span className="tier-name">{t.name}</span>
                <span className="tier-price">{formatPrice(t.price_cents)}</span>
                <span className="tier-avail small">
                  {soldOut ? 'Sold out' : t.available <= 10 ? `Only ${t.available} left` : `${t.available.toLocaleString()} left`}
                </span>
              </label>
            );
          })}
        </div>

        {tier && (
          <div className="reserve-row">
            <label className="qty">
              Quantity
              <select value={qty} onChange={(e) => chooseQty(Number(e.target.value))}>
                {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <div className="total">
              <span className="muted small">Total</span>
              <strong>{formatPrice(tier.price_cents * qty)}</strong>
            </div>
            <button className="btn" onClick={reserve} disabled={busy || cooldown > 0}>
              {busy ? 'Reserving…' : cooldown > 0 ? `Wait ${cooldown}s` : user ? 'Reserve' : 'Log in to reserve'}
            </button>
          </div>
        )}
        {!tier && <p className="muted">All tiers are sold out.</p>}

        {error && (
          <div className={`alert ${error.code === 'RATE_LIMITED' ? 'alert-warn' : 'alert-error'}`} role="alert">
            {error.code === 'RATE_LIMITED'
              ? `Too many attempts. You can try again in ${cooldown}s.`
              : isAmbiguous(error)
                ? `${error.message} Retrying is safe: you will not be booked twice.`
                : error.message}
          </div>
        )}
      </div>
    </section>
  );
}
