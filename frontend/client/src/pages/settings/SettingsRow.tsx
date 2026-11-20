import type { ReactNode } from 'react';

/** One "label: value" line on a settings tab; the value cell can hold buttons and inputs too. */
export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-row__label muted">{label}</span>
      <span className="settings-row__body">{children}</span>
    </div>
  );
}
