import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { OnlineMonthPage } from './OnlineMonthPage';

const request = vi.spyOn(globalThis, 'fetch');

describe('OnlineMonthPage', () => {
  it('rejects invalid calendar months without making requests', () => {
    request.mockClear();
    render(
      <MemoryRouter initialEntries={['/sales/online/2026-13']}>
        <Routes>
          <Route path="/sales/online/:month" element={<OnlineMonthPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('That month isn’t valid');
    expect(request).not.toHaveBeenCalled();
  });
});
