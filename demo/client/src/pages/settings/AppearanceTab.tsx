import {
  ACCENTS,
  DENSITIES,
  TEXT_SIZES,
  THEMES,
  useAppearance,
  type Accent,
} from '../../hooks/useAppearance';
import { SettingsRow } from './SettingsRow';

const LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Match my device',
  compact: 'Compact',
  comfortable: 'Comfortable',
  spacious: 'Spacious',
  small: 'Small',
  default: 'Default',
  large: 'Large',
};

/** The accent swatches show the brand colour in light theme, so they read the same in both. */
const ACCENT_SWATCH: Record<Accent, string> = {
  maroon: '#6b1111',
  blue: '#2a5db0',
  green: '#2f7a56',
  purple: '#6a3fb0',
  teal: '#1f7c8a',
};

/** A row of mutually exclusive buttons, e.g. Light / Dark / Match my device. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <SettingsRow label={label}>
      <div className="choice-group" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={`choice${option === value ? ' is-selected' : ''}`}
            onClick={() => onChange(option)}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>
    </SettingsRow>
  );
}

/** Theme, accent colour, text size and table density. Every change applies at once, everywhere. */
export function AppearanceTab() {
  const { appearance, update, reset } = useAppearance();

  return (
    <>
      <p className="muted">These are saved in this browser and apply to every account on it.</p>

      <h3 className="settings-section">Theme</h3>
      <Choice
        label="Theme"
        options={THEMES}
        value={appearance.theme}
        onChange={(theme) => update({ theme })}
      />
      <SettingsRow label="Accent colour">
        <div className="swatch-group" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((accent) => (
            <button
              key={accent}
              type="button"
              role="radio"
              aria-checked={accent === appearance.accent}
              aria-label={accent[0]!.toUpperCase() + accent.slice(1)}
              title={accent[0]!.toUpperCase() + accent.slice(1)}
              className={`swatch${accent === appearance.accent ? ' is-selected' : ''}`}
              style={{ background: ACCENT_SWATCH[accent] }}
              onClick={() => update({ accent })}
            />
          ))}
        </div>
      </SettingsRow>

      <h3 className="settings-section">Size and spacing</h3>
      <Choice
        label="Text size"
        options={TEXT_SIZES}
        value={appearance.textSize}
        onChange={(textSize) => update({ textSize })}
      />
      <Choice
        label="Table density"
        options={DENSITIES}
        value={appearance.density}
        onChange={(density) => update({ density })}
      />

      <h3 className="settings-section">Preview</h3>
      <div className="appearance-preview">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Soy candle</td>
              <td>12</td>
              <td>$18.00 CAD</td>
            </tr>
            <tr>
              <td>Hand soap</td>
              <td>4</td>
              <td>$7.50 CAD</td>
            </tr>
            <tr>
              <td>Wax melts</td>
              <td>30</td>
              <td>$5.00 CAD</td>
            </tr>
          </tbody>
        </table>
        <div className="settings-inline">
          <button type="button" className="button">
            Primary button
          </button>
          <button type="button" className="button button--secondary">
            Secondary
          </button>
          <button type="button" className="button button--danger">
            Delete
          </button>
        </div>
      </div>

      <div>
        <button type="button" className="button button--secondary" onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </>
  );
}
