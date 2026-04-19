import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar (apps/ui)', () => {
  it('renders <img> with correct src and alt when photoUrl is provided', () => {
    render(<Avatar name="Ramesh Kumar" photoUrl="https://x/y.png" />);
    const img = screen.getByRole('img', { name: 'Ramesh Kumar' }) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://x/y.png');
    expect(img.getAttribute('alt')).toBe('Ramesh Kumar');
  });

  it('renders initials fallback when photoUrl is missing', () => {
    render(<Avatar name="Ramesh Kumar" />);
    expect(screen.getByText('RK')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders initials fallback when photoUrl is null', () => {
    render(<Avatar name="Priya Sharma" photoUrl={null} />);
    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders initials fallback when photoUrl is an empty string', () => {
    render(<Avatar name="David Chen" photoUrl="" />);
    expect(screen.getByText('DC')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('falls back to initials when the image fires onError', () => {
    render(<Avatar name="Ramesh Kumar" photoUrl="https://broken/x.png" />);
    const img = screen.getByRole('img', { name: 'Ramesh Kumar' });
    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('RK')).toBeInTheDocument();
  });

  it('uses a single-letter initial when name has one word', () => {
    render(<Avatar name="Cher" />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});
