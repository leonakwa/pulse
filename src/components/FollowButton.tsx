'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setFollow } from '@/lib/follow-actions';

type Props = { targetId: string; initialFollowing: boolean };

export function FollowButton({ targetId, initialFollowing }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setBusy(true);
    setError(null);
    setFollowing(next); // shows the change straight away
    const res = await setFollow(targetId, next);
    setBusy(false);
    if (res.error) {
      setFollowing(!next);
      setError(res.error);
      return;
    }
    router.refresh(); // updates the follower counts
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
          following ? 'border border-line hover:border-danger hover:text-danger' : 'bg-brand text-brand-fg'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
