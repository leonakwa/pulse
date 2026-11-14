'use client';

import { useEffect, useState } from 'react';
import { sharePost, unsharePost } from '@/lib/share-actions';
import type { PostView } from '@/lib/posts';

type Change = { shareCount: number; sharedByMe: boolean; newPost?: PostView; removedPostId?: string };
type Props = { post: PostView; sharedByMe: boolean; currentUserId: string; onChanged: (change: Change) => void };

export function ShareMenu({ post, sharedByMe, currentUserId, onChanged }: Props) {
  const target = post.shareTarget;
  const isOwnTarget = target?.authorId === currentUserId;
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Outside links always point at the ORIGINAL post, so the original author is credited.
  const link = () => `${window.location.origin}/p/${target?.id ?? post.id}`;

  async function share() {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await sharePost(target.id, comment);
    setBusy(false);
    if (res.error) return setError(res.error);
    setComment('');
    setMessage('Shared to your profile and your followers.');
    onChanged({ shareCount: res.shareCount ?? 0, sharedByMe: true, newPost: res.post });
  }

  async function undo() {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await unsharePost(target.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    setMessage('Your share was removed.');
    onChanged({ shareCount: res.shareCount ?? 0, sharedByMe: false, removedPostId: res.removedId });
  }

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(link());
      setMessage('Link copied.');
    } catch {
      window.prompt('Copy this link', link());
    }
  }

  async function nativeShare() {
    setError(null);
    try {
      await navigator.share({
        title: `${target?.authorName ?? post.author.fullName} on PulseHive`,
        text: (target?.body ?? post.body).slice(0, 120),
        url: link(),
      });
    } catch {
      /* closed without sharing */
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-line p-3">
      {!target ? (
        <p className="text-sm text-muted">The original post is no longer available to share.</p>
      ) : isOwnTarget ? (
        <p className="text-sm text-muted">You cannot share your own post to your followers, but you can send the link.</p>
      ) : sharedByMe ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">You shared this post.</p>
          <button type="button" onClick={() => void undo()} disabled={busy} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-danger hover:text-danger disabled:opacity-60">
            {busy ? 'Working...' : 'Undo share'}
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor={`share-comment-${post.id}`} className="label">
            Share to your followers
          </label>
          <textarea
            id={`share-comment-${post.id}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Add a comment (optional)"
            className="input resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">{comment.length}/500 · credits {target.authorName}</span>
            <button type="button" onClick={() => void share()} disabled={busy} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg disabled:opacity-60">
              {busy ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" onClick={() => void copyLink()} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-brand">
          Copy link
        </button>
        {canNativeShare ? (
          <button type="button" onClick={() => void nativeShare()} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-brand">
            Share via...
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
