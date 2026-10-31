export default function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <span>{error.message || 'Something went wrong.'}</span>
      {onRetry && (
        <button type="button" className="btn btn-small btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
