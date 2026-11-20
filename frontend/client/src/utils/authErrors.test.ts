import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http';
import { checkAuthFields, describeAuthError } from './authErrors';

describe('checkAuthFields', () => {
  it('accepts valid login and registration details', () => {
    expect(checkAuthFields('login', { email: ' owner@example.com ', password: 'x' })).toEqual({});
    expect(
      checkAuthFields('register', {
        name: 'Test Business',
        email: 'owner@example.com',
        password: 'password123',
      }),
    ).toEqual({});
  });

  it('flags each field the server would reject', () => {
    expect(checkAuthFields('login', { email: 'owner@', password: '' })).toEqual({
      email: 'Enter a valid email',
      password: 'Enter your password',
    });
    expect(
      checkAuthFields('register', { name: '  ', email: 'owner', password: '1234567' }),
    ).toEqual({
      name: 'Enter your business name',
      email: 'Enter a valid email',
      password: 'Password must be at least 8 characters',
    });
  });
});

describe('describeAuthError', () => {
  it.each([
    [0, "Login failed. We couldn't reach the server."],
    [401, 'Login failed. The email or password is incorrect.'],
    [429, 'Login failed. There have been too many attempts.'],
    [503, 'Login failed. The service is temporarily unavailable.'],
    [500, 'Login failed. Something went wrong on our side.'],
  ])('explains a %i response', (status, expected) => {
    expect(describeAuthError('login', new ApiError(status, 'terse')).message).toContain(expected);
  });

  it('marks the email field when it is already registered', () => {
    const display = describeAuthError(
      'register',
      new ApiError(400, 'An account with that email already exists'),
    );
    expect(display.fieldErrors).toEqual({ email: 'This email is already registered' });
    expect(display.message).toMatch(/^Account creation failed\. An account with this email/);
  });

  it("keeps the server's first message for each field", () => {
    const display = describeAuthError(
      'register',
      new ApiError(400, 'Validation failed', [
        { field: 'email', message: 'Enter a valid email' },
        { field: 'email', message: 'Email must be at most 255 characters' },
      ]),
    );
    expect(display.fieldErrors).toEqual({ email: 'Enter a valid email' });
    expect(display.message).toBe(
      'Account creation failed. Fix the highlighted fields and try again.',
    );
  });

  it('falls back to a generic message for anything that is not an API error', () => {
    expect(describeAuthError('login', new Error('boom'))).toEqual({
      message: 'Login failed. Something unexpected went wrong. Please try again.',
      fieldErrors: {},
    });
  });
});
