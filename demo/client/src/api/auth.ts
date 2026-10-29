import type { Business } from '../types';
import { apiRequest } from './http';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function register(input: RegisterInput): Promise<Business> {
  return apiRequest('/auth/register', { method: 'POST', json: input });
}

export function login(input: LoginInput): Promise<Business> {
  return apiRequest('/auth/login', { method: 'POST', json: input });
}

export function logout(): Promise<void> {
  return apiRequest('/auth/logout', { method: 'POST' });
}

/** Permanently deletes the account and all its data; the server checks the password. */
export function deleteAccount(currentPassword: string): Promise<void> {
  return apiRequest('/auth/me', { method: 'DELETE', json: { currentPassword } });
}

/** Fields a business can edit; a field left out stays as it is, and "" clears type/country. */
export interface BusinessUpdate {
  name?: string;
  businessType?: string;
  country?: string;
  timeZone?: string;
  currency?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  description?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  etsy?: string;
}

/** Updates the logged-in business; returns the updated record. */
export function updateBusiness(update: BusinessUpdate): Promise<Business> {
  return apiRequest('/auth/me', { method: 'PATCH', json: update });
}

/** Sets the profile picture (a small JPEG, PNG or WebP); returns the updated record. */
export function uploadAvatar(image: Blob): Promise<Business> {
  return apiRequest('/auth/me/avatar', { method: 'PUT', blob: image });
}

export function deleteAvatar(): Promise<Business> {
  return apiRequest('/auth/me/avatar', { method: 'DELETE' });
}

/** Sets the business logo (a JPEG, PNG or WebP); returns the updated record. */
export function uploadLogo(image: Blob): Promise<Business> {
  return apiRequest('/auth/me/logo', { method: 'PUT', blob: image });
}

export function deleteLogo(): Promise<Business> {
  return apiRequest('/auth/me/logo', { method: 'DELETE' });
}

/** Changes the login email; the server checks the current password. */
export function changeEmail(email: string, currentPassword: string): Promise<Business> {
  return apiRequest('/auth/me/email', { method: 'PUT', json: { email, currentPassword } });
}

/** The logged-in business, or undefined if there's no valid session. */
export async function getCurrentBusiness(): Promise<Business | undefined> {
  try {
    return await apiRequest<Business>('/auth/me');
  } catch {
    return undefined;
  }
}
