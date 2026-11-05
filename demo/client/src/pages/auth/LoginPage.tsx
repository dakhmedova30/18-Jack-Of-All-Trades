import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { checkAuthFields, describeAuthError, fieldsMessage } from '../../utils/authErrors';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function clearFieldError(field: string) {
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = checkAuthFields('login', { email, password });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setError(fieldsMessage('login'));
      return;
    }

    setError(undefined);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const display = describeAuthError('login', err);
      setErrors(display.fieldErrors);
      setError(display.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-card__logo">Jack-Of-All-Trades</div>
        <h1>Welcome back</h1>
        <p className="muted">Log in to your business account.</p>

        <label className="auth-field" htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError('email');
            }}
            autoFocus
            required
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>

        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <div className="auth-password-control">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError('password');
              }}
              required
              aria-invalid={errors.password ? true : undefined}
            />
            <button
              type="button"
              className="auth-password-toggle"
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
          </div>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth-switch">
          Don&rsquo;t have a business account yet? <Link to="/register">Register</Link>
        </p>
      </form>
    </main>
  );
}
