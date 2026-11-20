import { ApiError } from '../api/http';

export type AuthAction = 'login' | 'register';

/** What the login and register forms show: a message above the button, plus messages under fields. */
export interface AuthErrorDisplay {
  message: string;
  fieldErrors: Record<string, string>;
}

const FAILED: Record<AuthAction, string> = {
  login: 'Login failed.',
  register: 'Account creation failed.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The same checks the server makes, run before sending so mistakes show straight away. */
export function checkAuthFields(
  action: AuthAction,
  fields: { name?: string; email: string; password: string },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (action === 'register' && !fields.name?.trim()) {
    errors.name = 'Enter your business name';
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = 'Enter a valid email';
  }
  if (action === 'login' && fields.password === '') {
    errors.password = 'Enter your password';
  } else if (action === 'register' && fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  return errors;
}

/** The message shown above the button when the fields have mistakes. */
export function fieldsMessage(action: AuthAction): string {
  return `${FAILED[action]} Fix the highlighted fields and try again.`;
}

/**
 * Turns a failed login or register request into messages a person can act on, instead of the
 * server's terse ones ("Validation failed", "Internal server error"). Field messages from the
 * server, such as "Enter a valid email", are kept as they are.
 */
export function describeAuthError(action: AuthAction, error: unknown): AuthErrorDisplay {
  const failed = FAILED[action];
  if (!(error instanceof ApiError)) {
    return {
      message: `${failed} Something unexpected went wrong. Please try again.`,
      fieldErrors: {},
    };
  }

  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of error.fieldErrors) {
    // Keep the first message for each field.
    fieldErrors[field] ??= message;
  }

  if (error.status === 0) {
    return {
      message: `${failed} We couldn't reach the server. Check your internet connection and try again.`,
      fieldErrors,
    };
  }
  if (error.status === 401) {
    return {
      message: 'Login failed. The email or password is incorrect. Check them and try again.',
      fieldErrors,
    };
  }
  if (error.status === 400 && error.message === 'An account with that email already exists') {
    return {
      message: `${failed} An account with this email already exists. Log in instead, or use a different email.`,
      fieldErrors: { ...fieldErrors, email: 'This email is already registered' },
    };
  }
  if (error.status === 400 && Object.keys(fieldErrors).length > 0) {
    return { message: fieldsMessage(action), fieldErrors };
  }
  if (error.status === 400) {
    return { message: `${failed} Check your details and try again.`, fieldErrors };
  }
  if (error.status === 429) {
    return {
      message: `${failed} There have been too many attempts. Wait a minute, then try again.`,
      fieldErrors,
    };
  }
  if (error.status === 503) {
    return {
      message: `${failed} The service is temporarily unavailable. Please try again in a moment.`,
      fieldErrors,
    };
  }
  if (error.status >= 500) {
    return {
      message: `${failed} Something went wrong on our side. Please try again in a moment.`,
      fieldErrors,
    };
  }
  return { message: `${failed} Please try again.`, fieldErrors };
}
