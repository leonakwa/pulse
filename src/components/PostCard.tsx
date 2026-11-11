'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { deletePost, updatePost } from '@/lib/post-actions';
import { timeAgo } from '@/lib/time';
import type { PostView } from '@/lib/posts';

type Props = {
  post: PostView;
  isOwn: boolean;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, body: string, editedAt: string | null) => void;
};

export function PostCard({ post, isOwn, onDeleted, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updatePost(post.id, draft);
    setBusy(false);
    if (res.error) return setError(res.error);
    onUpdated(post.id, res.body ?? '', res.editedAt ?? null);
    setEditing(false);
  }

  async function remove() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    const res = await deletePost(post.id);
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    onDeleted(post.id);
  }

  const profileHref = `/u/${post.author.username}`;
  const count = post.images.length;

  return (
    <article className="border-b border-line py-4">
      <div className="flex gap-3">
        <Link href={profileHref} aria-label={`${post.author.fullName}'s profile`}>
          <Avatar name={post.author.fullName} url={post.author.avatarUrl} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={profileHref} className="font-semibold hover:underline">
              {post.author.fullName}
            </Link>
            <span className="text-sm text-muted">
              @{post.author.username} ·{' '}
              <time dateTime={post.createdAt} suppressHydrationWarning>
                {timeAgo(post.createdAt)}
              </time>
              {post.editedAt ? ' · edited' : ''}
            </span>
          </div>

          {editing ? (
            <div className="mt-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} rows={4} className="input resize-none" />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || (draft.trim() === '' && count === 0)}
                  className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg disabled:opacity-60"
                >
                  {busy ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(post.body);
                    setError(null);
                  }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : post.body ? (
            <p className="mt-1 whitespace-pre-line break-words">{post.body}</p>
          ) : null}

          {count > 0 ? (
            <div className={`mt-3 grid gap-1 overflow-hidden rounded-xl ${count === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {post.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`Photo ${i + 1} from ${post.author.fullName}`}
                  loading="lazy"
                  decoding="async"
                  className={count === 1 ? 'max-h-[28rem] w-full object-cover' : 'aspect-square w-full object-cover'}
                />
              ))}
            </div>
          ) : null}

          {isOwn && !editing ? (
            <div className="mt-2 flex gap-1 text-sm">
              <button type="button" onClick={() => setEditing(true)} disabled={busy} className="btn-ghost !px-2 !py-1">
                Edit
              </button>
              <button type="button" onClick={remove} disabled={busy} className="btn-ghost !px-2 !py-1">
                {busy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
