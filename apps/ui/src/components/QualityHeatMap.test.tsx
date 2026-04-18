import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualityHeatMap from './QualityHeatMap';
import type { QualityBar } from './QualityHeatMap';

describe('QualityHeatMap', () => {
  it('renders exactly 5 default bars when no qualities prop is passed', () => {
    render(<QualityHeatMap />);
    expect(screen.getByText('Expertise')).toBeInTheDocument();
    expect(screen.getByText('Care')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Initiative')).toBeInTheDocument();
    expect(screen.getByText('Trust')).toBeInTheDocument();
  });

  it('renders bars given via qualities prop and reflects percentages', () => {
    const bars: QualityBar[] = [
      { name: 'Expertise', percentage: 35, color: '#3B82F6' },
      { name: 'Care', percentage: 12, color: '#EC4899' },
      { name: 'Delivery', percentage: 20, color: '#22C55E' },
      { name: 'Initiative', percentage: 8, color: '#F97316' },
      { name: 'Trust', percentage: 25, color: '#8B5CF6' },
    ];
    render(<QualityHeatMap qualities={bars} />);
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('reflects percentages via the aria-label on the root', () => {
    const bars: QualityBar[] = [
      { name: 'Expertise', percentage: 10, color: '#3B82F6' },
      { name: 'Care', percentage: 90, color: '#EC4899' },
    ];
    render(<QualityHeatMap qualities={bars} />);
    const root = screen.getByRole('img');
    expect(root).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Expertise: 10%'),
    );
    expect(root).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Care: 90%'),
    );
  });
});
