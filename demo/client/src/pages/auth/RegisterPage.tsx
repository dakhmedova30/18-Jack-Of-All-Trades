import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../api/http';
import { useAuth } from '../../hooks/useAuth';

type FieldName = 'name' | 'email' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        const fieldErrors: FieldErrors = {};
        for (const { field, message } of error.fieldErrors) {
          if (field === 'name' || field === 'email' || field === 'password') {
            fieldErrors[field] = message;
          }
        }
        setErrors(fieldErrors);
      }
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-card__logo">Jack-Of-All-Trades</div>
        <h1>Register your business</h1>
        <p className="muted">Create an account to get started.</p>

        <label className="auth-field" htmlFor="register-name">
          Business name
          <input
            id="register-name"
            autoComplete="organization"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={120}
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
          />
          {errors.name && (
            <span id="register-name-error" className="field-error" aria-live="polite">
              {errors.name}
            </span>
          )}
        </label>

        <label className="auth-field" htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
          />
          {errors.email && (
            <span id="register-email-error" className="field-error" aria-live="polite">
              {errors.email}
            </span>
          )}
        </label>

        <div className="auth-field">
          <label htmlFor="register-password">Password</label>
          <div className="auth-password-control">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password
                  ? 'register-password-hint register-password-error'
                  : 'register-password-hint'
              }
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
          <span id="register-password-hint" className="field-label__hint">
            Use at least 8 characters.
          </span>
          {errors.password && (
            <span id="register-password-error" className="field-error" aria-live="polite">
              {errors.password}
            </span>
          )}
        </div>

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
