'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { addComment, deleteComment, loadComments } from '@/lib/engagement-actions';
import { timeAgo } from '@/lib/time';
import type { CommentView } from '@/lib/comments';
import type { Cursor } from '@/lib/posts';

type Props = { postId: string; currentUserId: string; onCount: (count: number) => void };

export function Comments({ postId, currentUserId, onCount }: Props) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(from: Cursor | null) {
    setLoading(true);
    setError(null);
    const res = await loadComments(postId, from);
    setLoading(false);
    if ('error' in res) return setError(res.error);
    setComments((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...res.comments.filter((c) => !seen.has(c.id))];
    });
    setCursor(res.nextCursor);
  }

  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (busy || !value) return;
    setBusy(true);
    setError(null);
    const res = await addComment(postId, value);
    setBusy(false);
    const created = res.comment;
    if (res.error || !created) return setError(res.error ?? 'Could not post your comment.');
    setComments((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
    setText('');
    if (typeof res.commentCount === 'number') onCount(res.commentCount);
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this comment?')) return;
    setError(null);
    const res = await deleteComment(id);
    if (res.error) return setError(res.error);
    setComments((prev) => prev.filter((c) => c.id !== id));
    if (typeof res.commentCount === 'number') onCount(res.commentCount);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5 py-2">
          <Link href={`/u/${c.author.username}`} aria-label={`${c.author.fullName}'s profile`}>
            <Avatar name={c.author.fullName} url={c.author.avatarUrl} size={32} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">
                {c.author.fullName}
              </Link>{' '}
              <span className="text-muted">
                <time dateTime={c.createdAt} suppressHydrationWarning>
                  {timeAgo(c.createdAt)}
                </time>
              </span>
            </p>
            <p className="whitespace-pre-line break-words text-sm">{c.body}</p>
            {c.author.id === currentUserId ? (
              <button type="button" onClick={() => remove(c.id)} className="mt-0.5 text-xs font-medium text-muted hover:text-danger">
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {loading ? <p className="py-2 text-sm text-muted">Loading comments...</p> : null}
      {!loading && comments.length === 0 && !error ? <p className="py-2 text-sm text-muted">No comments yet. Start the conversation.</p> : null}
      {cursor && !loading ? (
        <button type="button" onClick={() => void load(cursor)} className="btn-ghost !px-0 text-sm">
          Load more comments
        </button>
      ) : null}

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <label htmlFor={`comment-${postId}`} className="sr-only">
          Write a comment
        </label>
        <input
          id={`comment-${postId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Write a comment..."
          className="input !py-2"
        />
        <button
          type="submit"
          disabled={busy || text.trim() === ''}
          className="shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-brand-fg disabled:opacity-60"
        >
          {busy ? '...' : 'Send'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
