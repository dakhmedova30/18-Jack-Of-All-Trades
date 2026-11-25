import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as publicProfileApi from '../../api/publicProfile';
import type { PublicProfile } from '../../types';
import { PublicProfilePage } from './PublicProfilePage';

vi.mock('../../api/publicProfile', () => ({
  getPublicProfile: vi.fn(),
}));

const profile: PublicProfile = {
  slug: 'rings',
  name: "Jinuo's Jewelry",
  description: 'Handmade rings',
  city: 'Toronto',
  region: 'ON',
  currency: 'CAD',
  email: null,
  phone: null,
  website: 'https://example.com',
  instagram: null,
  facebook: null,
  tiktok: null,
  etsy: null,
  logoUrl: null,
  items: [],
};

function renderProfile() {
  render(
    <MemoryRouter initialEntries={['/p/rings']}>
      <Routes>
        <Route path="/p/:slug" element={<PublicProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicProfilePage contact details', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('links the public email and phone so customers can reach the business', async () => {
    vi.mocked(publicProfileApi.getPublicProfile).mockResolvedValue({
      ...profile,
      email: 'hello@rings.example',
      phone: '+1 416-555-0100',
    });
    renderProfile();

    const contact = await screen.findByRole('list', { name: 'Contact' });
    expect(within(contact).getByRole('link', { name: 'hello@rings.example' })).toHaveAttribute(
      'href',
      'mailto:hello@rings.example',
    );
    expect(within(contact).getByRole('link', { name: '+1 416-555-0100' })).toHaveAttribute(
      'href',
      'tel:+14165550100',
    );
  });

  it('shows no contact section when the owner shares neither', async () => {
    vi.mocked(publicProfileApi.getPublicProfile).mockResolvedValue(profile);
    renderProfile();

    expect(await screen.findByRole('heading', { name: "Jinuo's Jewelry" })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Contact' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website' })).toBeInTheDocument();
  });
});
