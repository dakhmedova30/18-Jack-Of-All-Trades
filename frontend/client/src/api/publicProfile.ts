import type { PublicProfile } from '../types';
import { apiRequest } from './http';

/** A business's public profile; rejects with a 404 ApiError if there is none at that link. */
export function getPublicProfile(slug: string): Promise<PublicProfile> {
  return apiRequest(`/public/businesses/${encodeURIComponent(slug)}`);
}
