import type { AppNotification, NotificationSettings } from '../types';
import { apiRequest } from './http';

/** The alerts that apply right now. */
export function listNotifications(): Promise<AppNotification[]> {
  return apiRequest('/notifications');
}

export function getNotificationSettings(): Promise<NotificationSettings> {
  return apiRequest('/notifications/settings');
}

/** Replaces all the settings; the server rejects numbers out of range. */
export function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  return apiRequest('/notifications/settings', { method: 'PUT', json: settings });
}
