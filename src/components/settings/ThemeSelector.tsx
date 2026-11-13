'use client';

import { useState } from 'react';
import { updateSetting } from '@/lib/settings-actions';
import { applyTheme, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Bright background' },
  { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night' },
  { value: 'system', label: 'Device default', hint: 'Match your phone or computer' },
];

export function ThemeSelector({ initial }: { initial: Theme }) {
  const [value, setValue] = useState<Theme>(initial);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Theme) {
    setValue(next);
    applyTheme(next); // instant
    setError(null);
    const res = await updateSetting('theme', next);
    if (res.error) setError('Applied here, but it could not be saved to your account.');
  }

  return (
    <fieldset>
      <legend className="sr-only">Theme</legend>
      <div className="grid gap-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${value === o.value ? 'border-brand bg-brand/10' : 'border-line'}`}
          >
            <input type="radio" name="theme" value={o.value} checked={value === o.value} onChange={() => void choose(o.value)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
            <span>
              <span className="block font-semibold">{o.label}</span>
              <span className="block text-sm text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
