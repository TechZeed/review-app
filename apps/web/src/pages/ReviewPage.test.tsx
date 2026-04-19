import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewPage from './ReviewPage';

// crypto.subtle isn't needed for the landing render — we're not submitting.

function renderScan(slug = 'priya-sharma') {
  return render(
    <MemoryRouter initialEntries={[`/r/${slug}`]}>
      <Routes>
        <Route path="/r/:slug" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewPage (apps/web) — spec 25 photo on scan landing', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders the reviewee photo, name, and headline when the API returns photoUrl', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'p1',
        slug: 'priya-sharma',
        name: 'Priya Sharma',
        headline: 'Guest Relations Specialist',
        photoUrl: 'https://p/q.png',
        totalReviews: 12,
      }),
    }) as any;

    renderScan();

    await waitFor(() =>
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument(),
    );
    const img = screen.getByAltText('Priya Sharma') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://p/q.png');
    expect(screen.getByText('Guest Relations Specialist')).toBeInTheDocument();
  });

  it('falls back to initials when the API returns photoUrl: null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'p2',
        slug: 'ramesh-kumar',
        name: 'Ramesh Kumar',
        headline: 'Senior Sales Consultant',
        photoUrl: null,
        totalReviews: 0,
      }),
    }) as any;

    renderScan('ramesh-kumar');

    await waitFor(() =>
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument(),
    );
    expect(screen.getByText('RK')).toBeInTheDocument();
    expect(screen.queryByAltText('Ramesh Kumar')).toBeNull();
  });
});
