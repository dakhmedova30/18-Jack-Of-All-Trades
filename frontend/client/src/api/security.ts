import type { LoginEvent, SessionInfo } from '../types';
import { apiRequest } from './http';

/** Changes the password; the server logs out every other device. */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest('/auth/me/password', {
    method: 'PUT',
    json: { currentPassword, newPassword },
  });
}

/** Every device currently logged in, most recently active first. */
export function listSessions(): Promise<SessionInfo[]> {
  return apiRequest('/auth/sessions');
}

export function logOutOtherSessions(): Promise<void> {
  return apiRequest('/auth/sessions/logout-others', { method: 'POST' });
}

export function listLoginActivity(limit = 10): Promise<LoginEvent[]> {
  return apiRequest(`/auth/login-activity?limit=${limit}`);
}
