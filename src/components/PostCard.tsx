'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Comments } from '@/components/Comments';
import { toggleLike } from '@/lib/engagement-actions';
import { deletePost, updatePost } from '@/lib/post-actions';
import { timeAgo } from '@/lib/time';
import type { PostView } from '@/lib/posts';

type Props = {
  post: PostView;
  isOwn: boolean;
  currentUserId: string;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, body: string, editedAt: string | null) => void;
};

export function PostCard({ post, isOwn, currentUserId, onDeleted, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);

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

  async function like() {
    if (likeBusy) return;
    const next = !liked;
    setLikeBusy(true);
    setError(null);
    setLiked(next); // shows the change straight away
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const res = await toggleLike(post.id, next);
    setLikeBusy(false);
    if (res.error) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      return setError(res.error);
    }
    if (typeof res.likeCount === 'number') setLikeCount(res.likeCount);
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

          <div className="mt-2 flex items-center gap-5 text-sm">
            <button
              type="button"
              onClick={like}
              disabled={likeBusy}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={`flex items-center gap-1.5 py-1 ${liked ? 'text-brand' : 'text-muted hover:text-fg'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-4.6-9.3-9.1C1.1 8.6 2.9 5 6.3 5c2 0 3.4 1.1 4.2 2.3L12 9l1.5-1.7C14.3 6.1 15.7 5 17.7 5c3.4 0 5.2 3.6 3.6 6.9C19 16.4 12 21 12 21z" />
              </svg>
              {likeCount}
            </button>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              aria-expanded={showComments}
              aria-label="Comments"
              className={`flex items-center gap-1.5 py-1 ${showComments ? 'text-fg' : 'text-muted hover:text-fg'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
              {commentCount}
            </button>
            {isOwn && !editing ? (
              <>
                <button type="button" onClick={() => setEditing(true)} disabled={busy} className="py-1 text-muted hover:text-fg">
                  Edit
                </button>
                <button type="button" onClick={remove} disabled={busy} className="py-1 text-muted hover:text-danger">
                  {busy ? 'Deleting...' : 'Delete'}
                </button>
              </>
            ) : null}
          </div>

          {showComments ? <Comments postId={post.id} currentUserId={currentUserId} onCount={setCommentCount} /> : null}

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
