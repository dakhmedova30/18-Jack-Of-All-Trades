import type { Channel } from '../types';
import { apiRequest } from './http';

export function listChannels(): Promise<Channel[]> {
  return apiRequest('/channels');
}

export function createChannel(name: string): Promise<Channel> {
  return apiRequest('/channels', { method: 'POST', json: { name } });
}

export function renameChannel(id: number, name: string): Promise<Channel> {
  return apiRequest(`/channels/${id}`, { method: 'PUT', json: { name } });
}

/** Rejects with a 409 message if any sale still uses the channel. */
export function deleteChannel(id: number): Promise<void> {
  return apiRequest(`/channels/${id}`, { method: 'DELETE' });
}
