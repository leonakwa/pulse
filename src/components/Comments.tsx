'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { ReportButton } from '@/components/ReportButton';
import { addComment, deleteComment, loadComments, loadReplies, toggleCommentLike } from '@/lib/engagement-actions';
import { timeAgo } from '@/lib/time';
import type { CommentView } from '@/lib/comments';
import type { Cursor } from '@/lib/posts';

type RowProps = {
  comment: CommentView;
  postId: string;
  rootId: string; // the top-level comment that replies attach to
  currentUserId: string;
  onCount: (count: number) => void;
  onRemoved: (id: string) => void;
  onReplyAdded?: (reply: CommentView) => void; // given to replies; top-level comments handle this themselves
};

function CommentRow({ comment, postId, rootId, currentUserId, onCount, onRemoved, onReplyAdded }: RowProps) {
  const isReply = comment.parentId !== null;
  const own = comment.author.id === currentUserId;

  const [liked, setLiked] = useState(comment.likedByMe);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only used by top-level comments
  const [replies, setReplies] = useState<CommentView[]>([]);
  const [replyCount, setReplyCount] = useState(comment.replyCount);
  const [showReplies, setShowReplies] = useState(false);
  const [repliesCursor, setRepliesCursor] = useState<Cursor | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);

  async function like() {
    if (likeBusy) return;
    const next = !liked;
    setLikeBusy(true);
    setError(null);
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const res = await toggleCommentLike(comment.id, next);
    setLikeBusy(false);
    if (res.error) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      return setError(res.error);
    }
    if (typeof res.likeCount === 'number') setLikeCount(res.likeCount);
  }

  async function fetchReplies(from: Cursor | null) {
    setRepliesLoading(true);
    setError(null);
    const res = await loadReplies(comment.id, from);
    setRepliesLoading(false);
    if ('error' in res) return setError(res.error);
    setReplies((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...res.comments.filter((r) => !seen.has(r.id))];
    });
    setRepliesCursor(res.nextCursor);
    setRepliesLoaded(true);
  }

  function toggleReplies() {
    const next = !showReplies;
    setShowReplies(next);
    if (next && !repliesLoaded) void fetchReplies(null);
  }

  function handleNewReply(reply: CommentView) {
    setReplyCount((c) => c + 1);
    setShowReplies(true);
    if (!repliesLoaded) {
      void fetchReplies(null);
      return;
    }
    setReplies((prev) => (prev.some((r) => r.id === reply.id) ? prev : [...prev, reply]));
  }

  function handleReplyRemoved(id: string) {
    setReplies((prev) => prev.filter((r) => r.id !== id));
    setReplyCount((c) => Math.max(0, c - 1));
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const value = replyText.trim();
    if (!value || replyBusy) return;
    setReplyBusy(true);
    setError(null);
    const res = await addComment(postId, value, rootId);
    setReplyBusy(false);
    const created = res.comment;
    if (res.error || !created) return setError(res.error ?? 'Could not post your reply.');
    setReplyText('');
    setReplyOpen(false);
    if (typeof res.commentCount === 'number') onCount(res.commentCount);
    if (isReply) onReplyAdded?.(created);
    else handleNewReply(created);
  }

  async function remove() {
    if (!window.confirm(isReply ? 'Delete this reply?' : 'Delete this comment and its replies?')) return;
    setError(null);
    const res = await deleteComment(comment.id);
    if (res.error) return setError(res.error);
    if (typeof res.commentCount === 'number') onCount(res.commentCount);
    onRemoved(comment.id);
  }

  return (
    <div className="py-2">
      <div className="flex gap-2.5">
        <Link href={`/u/${comment.author.username}`} aria-label={`${comment.author.fullName}'s profile`}>
          <Avatar name={comment.author.fullName} url={comment.author.avatarUrl} size={isReply ? 28 : 32} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link href={`/u/${comment.author.username}`} className="font-semibold hover:underline">
              {comment.author.fullName}
            </Link>{' '}
            <span className="text-muted">
              <time dateTime={comment.createdAt} suppressHydrationWarning>
                {timeAgo(comment.createdAt)}
              </time>
            </span>
          </p>
          <p className="whitespace-pre-line break-words text-sm">{comment.body}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs font-medium text-muted">
            <button
              type="button"
              onClick={() => void like()}
              disabled={likeBusy}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike comment' : 'Like comment'}
              className={`flex items-center gap-1 py-0.5 ${liked ? 'text-brand' : 'hover:text-fg'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-4.6-9.3-9.1C1.1 8.6 2.9 5 6.3 5c2 0 3.4 1.1 4.2 2.3L12 9l1.5-1.7C14.3 6.1 15.7 5 17.7 5c3.4 0 5.2 3.6 3.6 6.9C19 16.4 12 21 12 21z" />
              </svg>
              {likeCount > 0 ? likeCount : 'Like'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!replyOpen && isReply && !replyText) setReplyText(`@${comment.author.username} `);
                setReplyOpen((v) => !v);
              }}
              aria-expanded={replyOpen}
              className="py-0.5 hover:text-fg"
            >
              Reply
            </button>
            {own ? (
              <button type="button" onClick={() => void remove()} className="py-0.5 hover:text-danger">
                Delete
              </button>
            ) : (
              <ReportButton type="comment" targetId={comment.id} className="py-0.5 font-medium text-muted hover:text-danger" />
            )}
          </div>

          {replyOpen ? (
            <form onSubmit={sendReply} className="mt-2 flex gap-2">
              <label htmlFor={`reply-${comment.id}`} className="sr-only">
                Write a reply
              </label>
              <input
                id={`reply-${comment.id}`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={300}
                autoFocus
                placeholder="Write a reply..."
                className="input !py-2 text-sm"
              />
              <button type="submit" disabled={replyBusy || replyText.trim() === ''} className="shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-brand-fg disabled:opacity-60">
                {replyBusy ? '...' : 'Reply'}
              </button>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {!isReply && replyCount > 0 ? (
        <div className="ml-10 mt-1">
          <button type="button" onClick={toggleReplies} className="text-xs font-semibold text-brand">
            {showReplies ? 'Hide replies' : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
          </button>
        </div>
      ) : null}

      {!isReply && showReplies ? (
        <div className="ml-10 border-l border-line pl-3">
          {replies.map((r) => (
            <CommentRow
              key={r.id}
              comment={r}
              postId={postId}
              rootId={comment.id}
              currentUserId={currentUserId}
              onCount={onCount}
              onRemoved={handleReplyRemoved}
              onReplyAdded={handleNewReply}
            />
          ))}
          {repliesLoading ? <p className="py-1 text-xs text-muted">Loading replies...</p> : null}
          {repliesCursor && !repliesLoading ? (
            <button type="button" onClick={() => void fetchReplies(repliesCursor)} className="py-1 text-xs font-semibold text-brand">
              More replies
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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

  return (
    <div className="mt-3 border-t border-line pt-3">
      {comments.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          postId={postId}
          rootId={c.id}
          currentUserId={currentUserId}
          onCount={onCount}
          onRemoved={(id) => setComments((prev) => prev.filter((x) => x.id !== id))}
        />
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
        <button type="submit" disabled={busy || text.trim() === ''} className="shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-brand-fg disabled:opacity-60">
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
