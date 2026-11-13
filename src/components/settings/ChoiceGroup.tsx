'use client';

import { useState } from 'react';
import { updateSetting } from '@/lib/settings-actions';

type Option = { value: string; label: string; hint: string };
type Props = { settingKey: string; legend: string; options: Option[]; initial: string };

export function ChoiceGroup({ settingKey, legend, options, initial }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    const res = await updateSetting(settingKey, next);
    if (res.error) {
      setValue(previous);
      setError(res.error);
    }
  }

  return (
    <fieldset className="py-3">
      <legend className="font-semibold">{legend}</legend>
      <div className="mt-2 grid gap-2">
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${value === o.value ? 'border-brand bg-brand/10' : 'border-line'}`}>
            <input type="radio" name={settingKey} value={o.value} checked={value === o.value} onChange={() => void choose(o.value)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
            <span>
              <span className="block font-medium">{o.label}</span>
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
