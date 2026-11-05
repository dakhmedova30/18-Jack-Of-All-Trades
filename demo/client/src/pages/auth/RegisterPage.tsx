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
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-card__logo">Jack-Of-All-Trades</div>
        <h1>Register your business</h1>
        <p className="muted">Create an account to get started.</p>

        <label className="auth-field" htmlFor="register-name">
          Business name
          <input
            id="register-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError('name');
            }}
            autoFocus
            maxLength={120}
            required
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label className="auth-field" htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError('email');
            }}
            required
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>

        <div className="auth-field">
          <label htmlFor="register-password">Password</label>
          <div className="auth-password-control">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError('password');
              }}
              minLength={8}
              maxLength={200}
              required
              aria-invalid={errors.password ? true : undefined}
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
          {errors.password && <span className="field-error">{errors.password}</span>}
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
    </div>
  );
}
