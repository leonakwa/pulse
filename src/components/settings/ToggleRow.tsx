'use client';

import { useState } from 'react';
import { updateSetting } from '@/lib/settings-actions';

type Props = { settingKey: string; label: string; description?: string; initial: boolean };

export function ToggleRow({ settingKey, label, description, initial }: Props) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setBusy(true);
    setError(null);
    setOn(next);
    const res = await updateSetting(settingKey, next);
    setBusy(false);
    if (res.error) {
      setOn(!next);
      setError(res.error);
    }
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{label}</p>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={busy}
          onClick={() => void toggle()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-brand' : 'bg-line'}`}
        >
          <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
