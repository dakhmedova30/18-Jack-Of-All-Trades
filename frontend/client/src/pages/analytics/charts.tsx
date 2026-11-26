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

/** The red pole of the skill's diverging pair (blue <-> red), for losses next to slot-1 blue profits. */
export const LOSS_COLOR = '#e34948';

/** The skill's fixed status colors. They always come with a text label, never color alone. */
export const STATUS_COLORS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' } as const;

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
  /** Formats values for the y-axis labels and hover text (e.g. cents -> "$1.2K").
   *  When given, the chart draws a labelled y-axis on round tick values. */
  formatValue?: (value: number) => string;
  /** Exact format for hover text; falls back to `formatValue`. */
  formatTooltip?: (value: number) => string;
}

const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };
/** Extra room on the left for y-axis labels like "$12.5K". */
const Y_AXIS_LEFT = 56;
const Y_TICKS = 4;
/** Rough width of one character of a 10px axis label, in viewBox units, plus a gap between labels. */
const LABEL_CHAR_WIDTH = 6;
const LABEL_GAP = 10;

/** Rounds `max / ticks` up to a 1/2/2.5/5 x 10^n step, so axis labels are round numbers. */
function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10;
  return step * magnitude;
}

/** Label every nth category so the x-axis labels don't overlap in `innerW`. */
function labelInterval(categories: string[], innerW: number): number {
  const labelWidth = Math.max(...categories.map((c) => c.length), 1) * LABEL_CHAR_WIDTH + LABEL_GAP;
  return Math.max(1, Math.ceil((labelWidth * (categories.length - 1)) / innerW));
}

export function LineChart({
  categories,
  series,
  width = 600,
  height = 230,
  ariaLabel,
  formatValue,
  formatTooltip,
}: LineChartProps) {
  const left = formatValue ? Y_AXIS_LEFT : PADDING.left;
  // The last x-axis label is centred on the right edge, so leave room for half of it ("Nov 2026").
  const right = Math.max(
    PADDING.right,
    ((categories.at(-1)?.length ?? 0) * LABEL_CHAR_WIDTH) / 2 + 6,
  );
  const innerW = width - left - right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const dataMax = Math.max(...series.flatMap((s) => s.values), 1);
  // With a y-axis, the top gridline sits on a round number at or above the data max.
  const step = formatValue ? niceStep(dataMax, Y_TICKS) : dataMax / Y_TICKS;
  const max = step * Y_TICKS;
  const format = formatTooltip ?? formatValue ?? ((v: number) => `$${v.toLocaleString()}`);

  const x = (i: number) =>
    left + (categories.length === 1 ? 0 : (i / (categories.length - 1)) * innerW);
  const y = (v: number) => PADDING.top + innerH - (v / max) * innerH;

  // Long periods have more points than there's room to label: label every `labelEvery`th one.
  const labelEvery = labelInterval(categories, innerW);
  // ...and smaller dots, so dense lines don't turn into a row of blobs.
  const dotRadius = categories.length > 40 ? 2 : categories.length > 20 ? 3 : 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="viz">
      {Array.from({ length: Y_TICKS + 1 }, (_, i) => i * step).map((tick) => (
        <g key={tick}>
          <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="viz-grid" />
          {formatValue && (
            <text
              x={left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="viz-label"
            >
              {formatValue(tick)}
            </text>
          )}
        </g>
      ))}
      {formatValue && (
        <line x1={left} y1={PADDING.top} x2={left} y2={PADDING.top + innerH} className="viz-axis" />
      )}
      <line
        x1={left}
        y1={PADDING.top + innerH}
        x2={width - right}
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
            <circle key={i} cx={x(i)} cy={y(v)} r={dotRadius} fill={colorForSeries(s.label, si)}>
              <title>{`${s.label}, ${categories[i]}: ${format(v)}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {categories.map((category, i) =>
        i % labelEvery === 0 ? (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="viz-label">
            {category}
          </text>
        ) : null,
      )}
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

interface ColumnChartProps {
  categories: string[];
  /** One series, or several stacked. Values may be negative (e.g. a loss): those go below zero. */
  series: ChartSeries[];
  width?: number;
  height?: number;
  ariaLabel: string;
  /** Formats the y-axis labels, e.g. compact money ("$1.2K"). */
  formatValue: (value: number) => string;
  /** Hover text for a whole column. Defaults to its category and each series' value. */
  describe?: (index: number) => string;
  /** A fixed color per series, in place of the palette order. */
  colors?: string[];
  /** Colors one series' columns by value, e.g. profit blue and loss red. Wins over `colors`. */
  colorForValue?: (value: number) => string;
  /** Counts can't be fractions, so keep the y-axis on whole numbers. */
  wholeNumbers?: boolean;
}

/**
 * Vertical bars, one column per category; several series stack, with a 2px gap between segments.
 * Every column has a hover target the full height of the plot, so short bars are easy to point at.
 */
export function ColumnChart({
  categories,
  series,
  width = 420,
  height = 220,
  ariaLabel,
  formatValue,
  describe,
  colors,
  colorForValue,
  wholeNumbers = false,
}: ColumnChartProps) {
  const left = Y_AXIS_LEFT;
  const innerW = width - left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  const column = (i: number) => series.map((s) => s.values[i] ?? 0);
  const ups = categories.map((_, i) => column(i).reduce((sum, v) => sum + Math.max(v, 0), 0));
  const downs = categories.map((_, i) => column(i).reduce((sum, v) => sum + Math.min(v, 0), 0));
  const dataMax = Math.max(...ups, 0);
  const dataMin = Math.min(...downs, 0);
  let step = niceStep(Math.max(dataMax - dataMin, wholeNumbers ? Y_TICKS : 1), Y_TICKS);
  if (wholeNumbers) step = Math.ceil(step);
  // Round numbers at both ends; the bottom stays at zero unless something is negative.
  const max = Math.max(Math.ceil(dataMax / step), dataMin < 0 ? 0 : 1) * step;
  const min = Math.floor(dataMin / step) * step;
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => min + i * step,
  );
  const y = (v: number) => PADDING.top + ((max - v) / (max - min)) * innerH;

  const band = innerW / categories.length;
  const barWidth = Math.min(band * 0.6, 36);
  const labelEvery = labelInterval(categories, innerW);
  const fill = (value: number, si: number) =>
    colorForValue?.(value) ?? colors?.[si] ?? colorForSeries(series[si]!.label, si);
  const defaultDescription = (i: number) =>
    `${categories[i]}: ${series.map((s) => `${s.label} ${formatValue(s.values[i] ?? 0)}`).join(', ')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="viz">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={width - PADDING.right}
            y1={y(tick)}
            y2={y(tick)}
            className="viz-grid"
          />
          <text
            x={left - 8}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="viz-label"
          >
            {formatValue(tick)}
          </text>
        </g>
      ))}
      <line x1={left} y1={PADDING.top} x2={left} y2={PADDING.top + innerH} className="viz-axis" />
      <line x1={left} y1={y(0)} x2={width - PADDING.right} y2={y(0)} className="viz-axis" />
      {categories.map((category, ci) => {
        const x = left + band * ci + (band - barWidth) / 2;
        let up = 0;
        let down = 0;
        return (
          <g key={ci}>
            {column(ci).map((value, si) => {
              if (value === 0) return null;
              const from = value > 0 ? up : down;
              const to = from + value;
              if (value > 0) up = to;
              else down = to;
              const top = y(Math.max(from, to));
              const segmentHeight = Math.abs(y(from) - y(to));
              return (
                <rect
                  key={si}
                  x={x}
                  y={top + 1}
                  width={barWidth}
                  height={Math.max(segmentHeight - 2, 1)}
                  fill={fill(value, si)}
                  rx={2}
                />
              );
            })}
            {ci % labelEvery === 0 && (
              <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="viz-label">
                {category}
              </text>
            )}
            <rect
              x={left + band * ci}
              y={PADDING.top}
              width={band}
              height={innerH}
              className="viz-hit"
            >
              <title>{(describe ?? defaultDescription)(ci)}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

export interface HorizontalBar {
  label: string;
  value: number;
  /** Keeps bars apart when two labels are the same (e.g. two items with one name). */
  id?: string | number;
  /** Extra hover text, e.g. "3 products". */
  detail?: string;
}

interface HorizontalBarChartProps {
  bars: HorizontalBar[];
  width?: number;
  ariaLabel: string;
  /** Unit for hover text, e.g. "units"; leave out when `formatTooltip` already says it ("$12.00"). */
  unit?: string;
  /** Formats the value printed after each bar, e.g. compact money ("$1.2k"). */
  formatValue?: (value: number) => string;
  /** Formats the value in hover text, e.g. full money ("$1,234.56"). */
  formatTooltip?: (value: number) => string;
}

const formatNumber = (value: number) => value.toLocaleString();

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
  formatValue = formatNumber,
  formatTooltip = formatNumber,
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
          <g key={bar.id ?? bar.label}>
            <title>{`${bar.label}: ${formatTooltip(bar.value)}${unit ? ` ${unit}` : ''}${bar.detail ? ` (${bar.detail})` : ''}`}</title>
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
              {formatValue(bar.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface CompactBarListProps {
  bars: HorizontalBar[];
  ariaLabel: string;
  /** Formats the value beside each label, e.g. compact money ("$1.2k"). */
  formatValue?: (value: number) => string;
  /** Formats the value in hover text, e.g. full money ("$1,234.56"). */
  formatTooltip?: (value: number) => string;
}

/**
 * HorizontalBarChart for narrow spaces like the filter side bar: each label and value sit on
 * their own line above a full-width bar, so the bars don't lose their width to the labels.
 */
export function CompactBarList({
  bars,
  ariaLabel,
  formatValue = formatNumber,
  formatTooltip = formatNumber,
}: CompactBarListProps) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <ul className="viz-bar-list" aria-label={ariaLabel}>
      {bars.map((bar) => (
        <li
          key={bar.label}
          className="viz-bar-list__item"
          title={`${bar.label}: ${formatTooltip(bar.value)}${bar.detail ? ` (${bar.detail})` : ''}`}
        >
          <div className="viz-bar-list__row">
            <span className="viz-bar-list__label">{bar.label}</span>
            <span className="viz-bar-list__value">{formatValue(bar.value)}</span>
          </div>
          <div className="viz-bar-list__track">
            {bar.value > 0 && (
              <div
                className="viz-bar-list__bar"
                style={{
                  width: `${Math.max((bar.value / max) * 100, 1)}%`,
                  background: bar.label === OTHER_LABEL ? OTHER_COLOR : SERIES_COLORS[2],
                }}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** @param colors one per label, for charts given fixed colors; otherwise the palette order. */
export function ChartLegend({ labels, colors }: { labels: string[]; colors?: string[] }) {
  return (
    <ul className="viz-legend">
      {labels.map((label, i) => (
        <li key={label}>
          <span
            className="viz-legend__swatch"
            style={{ background: colors?.[i] ?? colorForSeries(label, i) }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

export interface LevelSegment {
  label: string;
  count: number;
  color: string;
}

/**
 * One thick bar split into parts of a whole (e.g. items out of stock, low and well stocked), with
 * a legend that names each part and gives its count, so the color is never the only cue.
 */
export function SegmentedBar({
  segments,
  ariaLabel,
}: {
  segments: LevelSegment[];
  ariaLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0) || 1;
  return (
    <div className="viz-segmented">
      <div className="viz-segmented__bar" role="img" aria-label={ariaLabel}>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span
              key={s.label}
              className="viz-segmented__part"
              style={{ flexGrow: s.count, background: s.color }}
              title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            />
          ))}
      </div>
      <ul className="viz-legend viz-legend--row">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="viz-legend__swatch" style={{ background: s.color }} />
            <strong className="viz-legend__count">{s.count.toLocaleString()}</strong> {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ChartTableProps {
  /** Column headings; the first column names each row. */
  columns: string[];
  rows: (string | number)[][];
}

/** A chart's numbers as a table, closed by default: readable without hovering or seeing color. */
export function ChartTable({ columns, rows }: ChartTableProps) {
  return (
    <details className="viz-table">
      <summary>Show as a table</summary>
      <div className="viz-table__scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column, i) => (
                <th key={column} scope="col" className={i > 0 ? 'numeric' : undefined}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([first, ...rest], i) => (
              <tr key={i}>
                <th scope="row">{first}</th>
                {rest.map((cell, j) => (
                  <td key={j} className="numeric">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
