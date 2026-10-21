/**
 * Small hand-rolled SVG charts for the Analytics demo page. No charting library:
 * the data here is static/mock (see AnalyticsPage), so a dependency isn't worth it.
 *
 * Colors are the validated categorical palette from the dataviz skill (4 slots:
 * blue, orange, aqua, yellow), assigned in a fixed order so a series' color never
 * changes between charts on this page. Run the skill's validate_palette.js again
 * before changing these.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const;

/** Neutral color for a folded "Other" bucket (see analytics.service#buildTagSeries
 *  on the server) — overflow categories get a neutral color, not another hue
 *  competing with the real ones, per the dataviz skill's guidance. */
export const OTHER_LABEL = 'Other';
const OTHER_COLOR = '#9a9890';

function colorForSeries(label: string, index: number): string {
  return label === OTHER_LABEL ? OTHER_COLOR : (SERIES_COLORS[index] ?? OTHER_COLOR);
}

export interface ChartSeries {
  label: string;
  values: number[];
}

interface LineChartProps {
  categories: string[];
  series: ChartSeries[];
  width?: number;
  height?: number;
  ariaLabel: string;
}

const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

export function LineChart({
  categories,
  series,
  width = 600,
  height = 230,
  ariaLabel,
}: LineChartProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const max = Math.max(...series.flatMap((s) => s.values), 1);

  const x = (i: number) =>
    PADDING.left + (categories.length === 1 ? 0 : (i / (categories.length - 1)) * innerW);
  const y = (v: number) => PADDING.top + innerH - (v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="viz">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={PADDING.top + innerH * t}
          y2={PADDING.top + innerH * t}
          className="viz-grid"
        />
      ))}
      <line
        x1={PADDING.left}
        y1={PADDING.top + innerH}
        x2={width - PADDING.right}
        y2={PADDING.top + innerH}
        className="viz-axis"
      />
      {series.map((s, si) => (
        <g key={s.label}>
          <path
            d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')}
            fill="none"
            stroke={colorForSeries(s.label, si)}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {s.values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={colorForSeries(s.label, si)}>
              <title>{`${s.label}, ${categories[i]}: $${v.toLocaleString()}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {categories.map((category, i) => (
        <text key={category} x={x(i)} y={height - 8} textAnchor="middle" className="viz-label">
          {category}
        </text>
      ))}
    </svg>
  );
}

interface StackedBarChartProps {
  categories: string[];
  series: ChartSeries[];
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function StackedBarChart({
  categories,
  series,
  width = 280,
  height = 190,
  ariaLabel,
}: StackedBarChartProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const totals = categories.map((_, ci) => series.reduce((sum, s) => sum + (s.values[ci] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const bandWidth = innerW / categories.length;
  const barWidth = bandWidth * 0.5;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="viz">
      <line
        x1={PADDING.left}
        y1={PADDING.top + innerH}
        x2={width - PADDING.right}
        y2={PADDING.top + innerH}
        className="viz-axis"
      />
      {categories.map((category, ci) => {
        const x = PADDING.left + bandWidth * ci + (bandWidth - barWidth) / 2;
        let cursor = PADDING.top + innerH;
        return (
          <g key={category}>
            {series.map((s, si) => {
              const value = s.values[ci] ?? 0;
              const segmentHeight = (value / max) * innerH;
              const top = cursor - segmentHeight;
              cursor = top;
              if (value <= 0) return null;
              return (
                <rect
                  key={s.label}
                  x={x}
                  y={top + 1}
                  width={barWidth}
                  height={Math.max(segmentHeight - 2, 0)}
                  fill={colorForSeries(s.label, si)}
                  rx={2}
                >
                  <title>{`${s.label}, ${category}: $${value.toLocaleString()}`}</title>
                </rect>
              );
            })}
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="viz-label">
              {category}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface HorizontalBar {
  label: string;
  value: number;
  /** Extra hover text, e.g. "3 products". */
  detail?: string;
}

interface HorizontalBarChartProps {
  bars: HorizontalBar[];
  width?: number;
  ariaLabel: string;
  /** Unit for value labels and hover text, e.g. "units". */
  unit: string;
}

const HBAR = { row: 28, bar: 16, labelWidth: 110, valueWidth: 56, top: 4 };
const MAX_LABEL_CHARS = 15;

/**
 * One bar per category (y axis), length = value (x axis). A single series, so
 * every bar shares one color (category is read from the label, not the hue);
 * a folded "Other" bar gets the neutral color, as everywhere else.
 */
export function HorizontalBarChart({
  bars,
  width = 600,
  ariaLabel,
  unit,
}: HorizontalBarChartProps) {
  const height = HBAR.top * 2 + bars.length * HBAR.row;
  const barStart = HBAR.labelWidth;
  const innerW = width - HBAR.labelWidth - HBAR.valueWidth;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const bottom = height - HBAR.top;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="viz">
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={barStart + innerW * t}
          x2={barStart + innerW * t}
          y1={HBAR.top}
          y2={bottom}
          className="viz-grid"
        />
      ))}
      <line x1={barStart} x2={barStart} y1={HBAR.top} y2={bottom} className="viz-axis" />
      {bars.map((bar, i) => {
        const y = HBAR.top + i * HBAR.row + (HBAR.row - HBAR.bar) / 2;
        const barW = (bar.value / max) * innerW;
        const label =
          bar.label.length > MAX_LABEL_CHARS
            ? `${bar.label.slice(0, MAX_LABEL_CHARS - 1)}…`
            : bar.label;
        const color = bar.label === OTHER_LABEL ? OTHER_COLOR : SERIES_COLORS[2];
        return (
          <g key={bar.label}>
            <title>{`${bar.label}: ${bar.value.toLocaleString()} ${unit}${bar.detail ? ` (${bar.detail})` : ''}`}</title>
            <text
              x={barStart - 8}
              y={y + HBAR.bar / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="viz-label viz-label--bar"
            >
              {label}
            </text>
            {bar.value > 0 && (
              <rect
                x={barStart}
                y={y}
                width={Math.max(barW, 2)}
                height={HBAR.bar}
                fill={color}
                rx={2}
              />
            )}
            <text
              x={barStart + barW + 6}
              y={y + HBAR.bar / 2}
              dominantBaseline="middle"
              className="viz-label viz-label--bar"
            >
              {bar.value.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  ariaLabel: string;
}

export function DonutChart({ segments, size = 160, thickness = 30, ariaLabel }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  // Pure (no running-total mutation): the fraction before index i is just the
  // sum of the values before it. Segment counts here are tiny (<=4), so the
  // O(n^2) slice+reduce costs nothing.
  const fractionBefore = (index: number) =>
    segments.slice(0, index).reduce((sum, s) => sum + s.value, 0) / total;

  const arcs = segments.map((segment, i) => {
    const fraction = segment.value / total;
    const dash = fraction * circumference;
    return {
      key: segment.label,
      color: colorForSeries(segment.label, i),
      dashArray: `${Math.max(dash - 2, 0)} ${circumference - dash + 2}`,
      dashOffset: -(fractionBefore(i) * circumference),
      title: `${segment.label}: ${Math.round(fraction * 100)}%`,
    };
  });

  const labels = segments.map((segment, i) => {
    const fraction = segment.value / total;
    const midAngle = (fractionBefore(i) + fraction / 2) * 2 * Math.PI - Math.PI / 2;
    return {
      key: segment.label,
      x: cx + Math.cos(midAngle) * r,
      y: cy + Math.sin(midAngle) * r,
      text: `${Math.round(fraction * 100)}%`,
      index: i,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className="viz">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
          >
            <title>{arc.title}</title>
          </circle>
        ))}
      </g>
      {labels.map((label) => (
        <text
          key={label.key}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="viz-donut-label"
          fill={
            needsDarkText(colorForSeries(segments[label.index]!.label, label.index))
              ? '#1f1f1f'
              : '#ffffff'
          }
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

/** Yellow (slot 4) and the neutral "Other" gray both need dark text to stay readable. */
function needsDarkText(hex: string): boolean {
  return hex === SERIES_COLORS[3] || hex === OTHER_COLOR;
}

export function ChartLegend({ labels }: { labels: string[] }) {
  return (
    <ul className="viz-legend">
      {labels.map((label, i) => (
        <li key={label}>
          <span className="viz-legend__swatch" style={{ background: colorForSeries(label, i) }} />
          {label}
        </li>
      ))}
    </ul>
  );
}
