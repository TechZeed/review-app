import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar (apps/web)', () => {
  it('renders <img> with src and alt when photoUrl provided', () => {
    render(<Avatar name="Priya Sharma" photoUrl="https://x/y.png" />);
    const img = screen.getByAltText('Priya Sharma') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://x/y.png');
  });

  it('renders initials fallback when photoUrl is missing', () => {
    render(<Avatar name="Priya Sharma" />);
    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders initials fallback when photoUrl is null', () => {
    render(<Avatar name="David Chen" photoUrl={null} />);
    expect(screen.getByText('DC')).toBeInTheDocument();
  });

  it('falls back to initials on image onError', () => {
    render(<Avatar name="Priya Sharma" photoUrl="https://broken/x.png" />);
    const img = screen.getByAltText('Priya Sharma');
    fireEvent.error(img);
    expect(screen.queryByAltText('Priya Sharma')).toBeNull();
    expect(screen.getByText('PS')).toBeInTheDocument();
  });
});
