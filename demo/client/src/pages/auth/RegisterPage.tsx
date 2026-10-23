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
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={120}
            required
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label className="auth-field" htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>

        <label className="auth-field" htmlFor="register-password">
          Password
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        {submitError && <p className="form-error">{submitError}</p>}

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
