import type { Business, Item } from '../types';

/**
 * Complete records for tests, so a field added to a type is added here once instead of in every
 * test. Spread and override what a test cares about: `{ ...testItem, name: 'Coffee' }`.
 */
export const testBusiness: Business = {
  id: 1,
  name: 'Test Business',
  email: 'owner@example.com',
  businessType: null,
  country: null,
  timeZone: 'UTC',
  currency: 'CAD',
  lowStockThreshold: 5,
  lastLoginAt: null,
  avatarUrl: null,
  ownerFirstName: null,
  ownerLastName: null,
  phone: null,
  addressLine: null,
  city: null,
  region: null,
  postalCode: null,
  description: null,
  website: null,
  instagram: null,
  facebook: null,
  tiktok: null,
  etsy: null,
  logoUrl: null,
  publicSlug: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const testItem: Item = {
  id: 1,
  name: 'Tea',
  quantity: 12,
  unitPriceCents: 450,
  tags: ['Drinks'],
  note: '',
  isPublic: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
