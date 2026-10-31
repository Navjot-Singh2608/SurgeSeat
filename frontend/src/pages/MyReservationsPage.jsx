import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatPrice } from '../utils/format';

export default function MyReservationsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.listMyReservations().then((d) => setItems(d.items)).catch(setError);
  }, []);

  useEffect(load, [load]);

  return (
    <section>
      <div className="page-head">
        <h1>My reservations</h1>
        <button className="btn btn-small btn-ghost" onClick={load}>Refresh</button>
      </div>
      <ErrorMessage error={error} onRetry={load} />
      {!items && !error && <Spinner label="Loading reservations" />}
      {items && items.length === 0 && (
        <p className="muted">No reservations yet. <Link to="/events">Browse events</Link>.</p>
      )}
      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Event</th><th>Tier</th><th>Qty</th><th>Total</th><th>Reserved</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/reservations/${r.id}`}>{r.event_name}</Link></td>
                  <td>{r.tier_name}</td>
                  <td>{r.qty}</td>
                  <td>{r.total_price_cents != null ? formatPrice(r.total_price_cents) : '–'}</td>
                  <td className="muted small">{formatDateTime(r.created_at)}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
