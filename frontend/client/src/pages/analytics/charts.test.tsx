import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ColumnChart } from './charts';

const dollars = (cents: number) => String(cents / 100);

describe('ColumnChart', () => {
  it('draws losses below the zero line, in their own color', () => {
    const { container } = render(
      <ColumnChart
        categories={['Oct', 'Nov']}
        series={[{ label: 'Profit', values: [20000, -10000] }]}
        ariaLabel="Profit"
        formatValue={dollars}
        colorForValue={(cents) => (cents < 0 ? 'red' : 'blue')}
      />,
    );

    // The axis runs from a round number below the loss to one at or above the profit.
    for (const tick of ['-100', '0', '100', '200']) {
      expect(screen.getByText(tick)).toBeInTheDocument();
    }
    const zeroLine = container.querySelectorAll('line.viz-axis')[1]!;
    const zeroY = Number(zeroLine.getAttribute('y1'));
    const [profit, loss] = container.querySelectorAll('rect:not(.viz-hit)');
    expect(profit).toHaveAttribute('fill', 'blue');
    expect(Number(profit!.getAttribute('y')) + Number(profit!.getAttribute('height'))).toBeLessThan(
      zeroY,
    );
    expect(loss).toHaveAttribute('fill', 'red');
    expect(Number(loss!.getAttribute('y'))).toBeGreaterThan(zeroY);
    // Each whole column is a hover target that names its value. (getByTitle only finds a title
    // directly under <svg>, so read the targets' own titles.)
    const hoverText = [...container.querySelectorAll('rect.viz-hit > title')].map(
      (t) => t.textContent,
    );
    expect(hoverText).toEqual(['Oct: Profit 200', 'Nov: Profit -100']);
  });

  it('keeps counts on whole-number ticks', () => {
    render(
      <ColumnChart
        categories={['Oct', 'Nov']}
        series={[{ label: 'Sales', values: [1, 3] }]}
        ariaLabel="Sales"
        formatValue={String}
        wholeNumbers
      />,
    );

    for (const tick of ['0', '1', '2', '3']) {
      expect(screen.getByText(tick)).toBeInTheDocument();
    }
    expect(screen.queryByText('0.5')).not.toBeInTheDocument();
  });
});
