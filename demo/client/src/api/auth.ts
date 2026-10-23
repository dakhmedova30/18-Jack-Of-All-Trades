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

/** The logged-in business, or undefined if there's no valid session. */
export async function getCurrentBusiness(): Promise<Business | undefined> {
  try {
    return await apiRequest<Business>('/auth/me');
  } catch {
    return undefined;
  }
}
