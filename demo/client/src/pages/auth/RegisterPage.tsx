import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { checkAuthFields, describeAuthError, fieldsMessage } from '../../utils/authErrors';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function clearFieldError(field: string) {
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = checkAuthFields('register', { name, email, password });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setSubmitError(fieldsMessage('register'));
      return;
    }

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (error) {
      const display = describeAuthError('register', error);
      setErrors(display.fieldErrors);
      setSubmitError(display.message);
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
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError('name');
            }}
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
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError('email');
            }}
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
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError('password');
              }}
              minLength={8}
              maxLength={200}
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
