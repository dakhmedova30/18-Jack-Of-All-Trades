import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page">
      <div className="empty-state">
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/" className="button">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
