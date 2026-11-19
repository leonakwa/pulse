'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { PeoplePicker, type PickPerson } from '@/components/PeoplePicker';
import { addMembers, leaveGroup, removeMember, renameGroup } from '@/lib/group-actions';

export type GroupMember = { id: string; username: string; fullName: string; avatarUrl: string | null; role: 'owner' | 'member' };

type Props = { conversationId: string; groupName: string; members: GroupMember[]; myId: string; myRole: 'owner' | 'member' };

export function GroupPanel({ conversationId, groupName, members, myId, myRole }: Props) {
  const router = useRouter();
  const isOwner = myRole === 'owner';
  const [name, setName] = useState(groupName);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<PickPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<{ error?: string }>, done?: () => void, success?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await action();
    setBusy(false);
    if (res.error) return setError(res.error);
    if (success) setMessage(success);
    done?.();
    router.refresh();
  }

  return (
    <div className="space-y-5 text-sm">
      {isOwner ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== groupName) void run(() => renameGroup(conversationId, name), undefined, 'Group renamed.');
          }}
          className="flex gap-2"
        >
          <label htmlFor="rename-group" className="sr-only">
            Group name
          </label>
          <input id="rename-group" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input !py-2" />
          <button type="submit" disabled={busy || !name.trim() || name.trim() === groupName} className="shrink-0 rounded-full border border-line px-4 font-semibold hover:border-brand disabled:opacity-60">
            Rename
          </button>
        </form>
      ) : null}

      <div>
        <p className="font-semibold">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        <ul className="mt-2 divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <Link href={`/u/${m.username}`} aria-label={`${m.fullName}'s profile`}>
                <Avatar name={m.fullName} url={m.avatarUrl} size={40} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.fullName}
                  {m.id === myId ? <span className="font-normal text-muted"> (you)</span> : null}
                </p>
                <p className="truncate text-muted">@{m.username}{m.role === 'owner' ? ' · Owner' : ''}</p>
              </div>
              {isOwner && m.id !== myId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove ${m.fullName} from the group?`)) void run(() => removeMember(conversationId, m.id));
                  }}
                  className="rounded-full border border-line px-3 py-1 font-semibold text-muted hover:border-danger hover:text-danger disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {isOwner ? (
        adding ? (
          <div className="rounded-2xl border border-line p-3">
            <PeoplePicker currentUserId={myId} excludeIds={members.map((m) => m.id)} selected={selected} onChange={setSelected} max={Math.max(0, 50 - members.length)} />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy || selected.length === 0}
                onClick={() =>
                  void run(
                    () => addMembers(conversationId, selected.map((p) => p.id)),
                    () => {
                      setSelected([]);
                      setAdding(false);
                    },
                    'People added.',
                  )
                }
                className="rounded-full bg-brand px-5 py-2 font-semibold text-brand-fg disabled:opacity-60"
              >
                {busy ? 'Adding...' : `Add ${selected.length || ''}`.trim()}
              </button>
              <button type="button" onClick={() => { setAdding(false); setSelected([]); }} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} disabled={members.length >= 50} className="rounded-full border border-line px-5 py-2 font-semibold hover:border-brand disabled:opacity-60">
            Add people
          </button>
        )
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm('Leave this group? You will stop receiving its messages.')) {
            void (async () => {
              setBusy(true);
              const res = await leaveGroup(conversationId);
              if (res.error) {
                setBusy(false);
                return setError(res.error);
              }
              router.push('/messages');
              router.refresh();
            })();
          }
        }}
        className="block rounded-full border border-danger/50 px-5 py-2 font-semibold text-danger hover:bg-danger/10 disabled:opacity-60"
      >
        Leave group
      </button>

      {message ? (
        <p role="status" className="text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
