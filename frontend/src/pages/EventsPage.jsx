import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import { formatDateTime, formatPrice } from '../utils/format';

const PAGE_SIZE = 12;

export default function EventsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    api.listEvents({ page, pageSize: PAGE_SIZE }).then(setData).catch(setError);
  }, [page]);

  useEffect(load, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <section>
      <div className="page-head">
        <h1>Upcoming events</h1>
      </div>
      <ErrorMessage error={error} onRetry={load} />
      {!data && !error && <Spinner label="Loading events" />}
      {data && data.items.length === 0 && <p className="muted">No events yet.</p>}
      {data && (
        <div className="grid">
          {data.items.map((e) => (
            <Link to={`/events/${e.id}`} key={e.id} className="card event-card">
              <div className="event-date">{formatDateTime(e.starts_at)}</div>
              <h2>{e.name}</h2>
              <p className="muted small">{e.venue}</p>
              <div className="event-foot">
                <span>From {formatPrice(e.min_price_cents)}</span>
                {e.available > 0 ? (
                  <span className="muted small">~{e.available.toLocaleString()} left</span>
                ) : (
                  <span className="badge badge-expired">Sold out</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      {data && totalPages > 1 && (
        <div className="pager">
          <button className="btn btn-small btn-ghost" disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) })}>Previous</button>
          <span className="muted small">Page {page} of {totalPages}</span>
          <button className="btn btn-small btn-ghost" disabled={page >= totalPages}
            onClick={() => setParams({ page: String(page + 1) })}>Next</button>
        </div>
      )}
      <p className="muted small note">Availability shown here is approximate (cached). The reservation itself is the source of truth.</p>
    </section>
  );
}
