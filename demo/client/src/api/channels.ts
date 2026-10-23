import type { Channel } from '../types';
import { apiRequest } from './http';

export function listChannels(): Promise<Channel[]> {
  return apiRequest('/channels');
}

export function createChannel(name: string): Promise<Channel> {
  return apiRequest('/channels', { method: 'POST', json: { name } });
}
