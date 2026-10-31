const LABELS = {
  PENDING: 'Processing',
  CONFIRMED: 'Confirmed',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${(status || '').toLowerCase()}`}>{LABELS[status] || status}</span>;
}
