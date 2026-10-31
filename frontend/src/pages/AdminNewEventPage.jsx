import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import ErrorMessage from '../components/ErrorMessage';

const emptyTier = () => ({ name: '', price: '', capacity: '' });

export default function AdminNewEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', venue: '', starts_at: '', description: '' });
  const [tiers, setTiers] = useState([emptyTier()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const setTier = (i, patch) => setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createEvent({
        name: form.name.trim(),
        venue: form.venue.trim(),
        description: form.description.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        tiers: tiers.map((t) => ({
          name: t.name.trim(),
          price_cents: Math.round(Number(t.price) * 100),
          capacity: Number(t.capacity),
        })),
      });
      navigate(`/events/${created.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>New event</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Venue<input required value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
        <label>Starts at
          <input type="datetime-local" required value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </label>
        <label>Description
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>

        <fieldset className="tier-editor">
          <legend>Ticket tiers</legend>
          {tiers.map((t, i) => (
            <div className="tier-edit-row" key={i}>
              <input placeholder="Name" required value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} />
              <input placeholder="Price (CAD)" type="number" min="0" step="0.01" required value={t.price}
                onChange={(e) => setTier(i, { price: e.target.value })} />
              <input placeholder="Capacity" type="number" min="1" step="1" required value={t.capacity}
                onChange={(e) => setTier(i, { capacity: e.target.value })} />
              <button type="button" className="btn btn-small btn-ghost" disabled={tiers.length === 1}
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="Remove tier">Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setTiers([...tiers, emptyTier()])}>
            + Add tier
          </button>
        </fieldset>

        <ErrorMessage error={error} />
        <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
      </form>
    </section>
  );
}
