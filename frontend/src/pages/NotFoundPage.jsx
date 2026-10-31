import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="card narrow">
      <h1>Page not found</h1>
      <p className="muted"><Link to="/events">Back to events</Link></p>
    </div>
  );
}
