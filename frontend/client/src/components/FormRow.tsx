import type { ReactNode } from 'react';

interface FormRowProps {
  label: string;
  hint?: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/** A label and control row in the shared modal-form layout (the `.form-row` styles). */
export function FormRow({ label, hint, htmlFor, error, required = false, children }: FormRowProps) {
  return (
    <div className="form-row">
      <label htmlFor={htmlFor}>
        <span>
          {label}
          {required && (
            <span className="required-marker" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
        {hint && <span className="field-label__hint">{hint}</span>}
      </label>
      <div className="form-row__control">
        {children}
        {error && (
          <span id={`${htmlFor}-error`} className="field-error" aria-live="polite">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
