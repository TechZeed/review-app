import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewCard from './ReviewCard';
import type { Review } from '../lib/api';

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    profileId: 'p1',
    qualities: ['expertise', 'trust'],
    thumbsUp: true,
    verifiable: false,
    createdAt: '2026-04-18T02:30:30.600Z',
    ...overrides,
  };
}

describe('ReviewCard', () => {
  it('renders a formatted date for a valid createdAt', () => {
    const { container } = render(<ReviewCard review={makeReview()} />);
    expect(container.textContent).toMatch(/Apr 18, 2026/);
    expect(container.textContent).not.toMatch(/Invalid Date/);
  });

  it('renders empty (not "Invalid Date") when createdAt is missing', () => {
    const review = makeReview({ createdAt: undefined as unknown as string });
    const { container } = render(<ReviewCard review={review} />);
    expect(container.textContent).not.toMatch(/Invalid Date/);
  });

  it('renders empty when createdAt is an unparseable string', () => {
    const review = makeReview({ createdAt: 'not-a-date' });
    const { container } = render(<ReviewCard review={review} />);
    expect(container.textContent).not.toMatch(/Invalid Date/);
  });

  it('renders all qualities as chips', () => {
    render(
      <ReviewCard review={makeReview({ qualities: ['expertise', 'trust', 'care'] })} />,
    );
    expect(screen.getByText('expertise')).toBeInTheDocument();
    expect(screen.getByText('trust')).toBeInTheDocument();
    expect(screen.getByText('care')).toBeInTheDocument();
  });
});
