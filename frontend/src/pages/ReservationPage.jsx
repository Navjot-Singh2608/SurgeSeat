import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatPrice } from '../utils/format';

const TERMINAL = new Set(['CONFIRMED', 'EXPIRED', 'FAILED', 'CANCELLED']);
const POLL_START_MS = 1000;
const POLL_MAX_MS = 5000;
const GIVE_UP_AFTER_MS = 90_000;

// The reservation is confirmed asynchronously (outbox -> Kafka -> worker),
// so the page polls with gentle backoff until it reaches a final state.
export default function ReservationPage() {
  const { id } = useParams();
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    let timer;
    let cancelled = false;
    let interval = POLL_START_MS;
    started.current = Date.now();

    async function tick() {
      try {
        const r = await api.getReservation(id);
        if (cancelled) return;
        setRes(r);
        setError(null);
        if (TERMINAL.has(r.status)) return;
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404 || err.status === 401) {
          setError(err);
          return;
        }
        setError(err); // transient: keep polling
      }
      if (Date.now() - started.current > GIVE_UP_AFTER_MS) {
        setSlow(true);
        return;
      }
      interval = Math.min(POLL_MAX_MS, Math.round(interval * 1.4));
      timer = setTimeout(tick, interval);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (!res && error) return <ErrorMessage error={error} />;
  if (!res) return <Spinner label="Loading reservation" />;

  return (
    <section className="card narrow">
      <div className="page-head">
        <h1>Reservation</h1>
        <StatusBadge status={res.status} />
      </div>

      {res.status === 'PENDING' && !slow && (
        <div className="alert alert-info">
          <span className="spinner small" aria-hidden="true" /> Your seats are held. Confirming your booking…
        </div>
      )}
      {res.status === 'PENDING' && slow && (
        <div className="alert alert-warn">
          This is taking longer than usual. Your seats are still held; check <Link to="/reservations">My reservations</Link> shortly.
        </div>
      )}
      {res.status === 'CONFIRMED' && <div className="alert alert-success">Booked. A confirmation email is on its way.</div>}
      {res.status === 'EXPIRED' && <div className="alert alert-error">This hold expired before it was confirmed. The tickets were released.</div>}
      {res.status === 'FAILED' && <div className="alert alert-error">We could not complete this booking. The tickets were released.</div>}
      {error && res && <p className="muted small">Connection hiccup, still checking…</p>}

      <dl className="kv">
        <dt>Event</dt><dd><Link to={`/events/${res.event_id}`}>{res.event_name}</Link></dd>
        <dt>Tier</dt><dd>{res.tier_name}</dd>
        <dt>Quantity</dt><dd>{res.qty}</dd>
        {res.total_price_cents != null && (<><dt>Total</dt><dd>{formatPrice(res.total_price_cents)}</dd></>)}
        <dt>Reserved</dt><dd>{formatDateTime(res.created_at)}</dd>
        <dt>Reference</dt><dd><code>{res.id}</code></dd>
      </dl>
      <Link to="/reservations" className="btn btn-ghost">All my reservations</Link>
    </section>
  );
}
