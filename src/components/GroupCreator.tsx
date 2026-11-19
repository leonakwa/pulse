'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGroup } from '@/lib/group-actions';
import { PeoplePicker, type PickPerson } from '@/components/PeoplePicker';

export function GroupCreator({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PickPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await createGroup(name, selected.map((p) => p.id));
    if (res.error || !res.id) {
      setBusy(false);
      return setError(res.error ?? 'Could not create the group.');
    }
    router.push(`/messages/${res.id}`);
  }

  const ready = name.trim().length > 0 && selected.length >= 2;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="group-name" className="label">
          Group name
        </label>
        <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="For example: Weekend plans" className="input" />
      </div>

      <div>
        <p className="label">Add people ({selected.length}/49, pick at least 2)</p>
        <PeoplePicker currentUserId={userId} selected={selected} onChange={setSelected} max={49} />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button type="button" onClick={() => void create()} disabled={!ready || busy} className="btn-primary">
        {busy ? 'Creating...' : 'Create group'}
      </button>
    </div>
  );
}
