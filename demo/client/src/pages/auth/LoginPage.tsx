import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/http';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-card__logo">Jack-Of-All-Trades</div>
        <h1>Welcome back</h1>
        <p className="muted">Log in to your business account.</p>

        <label className="auth-field" htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
            required
          />
        </label>

        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <div className="auth-password-control">
          <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
          />
          <button
              type="button"
              className="auth-password-toggle"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
          >
              {showPassword ? 'Hide password' : 'Show password'}
          </button>
          </div>
      </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth-switch">
          Don&rsquo;t have a business account yet? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
