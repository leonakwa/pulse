'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Composer } from '@/components/Composer';
import { PostCard } from '@/components/PostCard';
import { loadMorePosts } from '@/lib/post-actions';
import type { Cursor, PostView, Scope } from '@/lib/posts';

type Props = {
  scope: Scope;
  authorId?: string;
  currentUserId: string;
  initialPosts: PostView[];
  initialCursor: Cursor | null;
  composer?: { name: string; avatarUrl: string | null };
  emptyTitle: string;
  emptyText: string;
};

export function Feed({ scope, authorId, currentUserId, initialPosts, initialCursor, composer, emptyTitle, emptyText }: Props) {
  const [posts, setPosts] = useState<PostView[]>(initialPosts);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const res = await loadMorePosts(scope, authorId ?? null, cursor);
    if ('error' in res) {
      setError(res.error);
    } else {
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    }
    loadingRef.current = false;
    setLoading(false);
  }, [scope, authorId, cursor]);

  // Load the next page when the bottom of the list comes near the screen.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <div>
      {composer ? (
        <Composer
          userId={currentUserId}
          name={composer.name}
          avatarUrl={composer.avatarUrl}
          onCreated={(post) => setPosts((prev) => [post, ...prev])}
        />
      ) : null}

      {posts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">{emptyText}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            isOwn={post.author.id === currentUserId}
            onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            onUpdated={(id, body, editedAt) =>
              setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, body, editedAt } : p)))
            }
          />
        ))
      )}

      <div ref={sentinelRef} />
      {loading ? <p className="py-4 text-center text-sm text-muted">Loading...</p> : null}
      {error ? (
        <p role="alert" className="py-2 text-center text-sm text-danger">
          {error}
        </p>
      ) : null}
      {cursor && !loading ? (
        <div className="py-4 text-center">
          <button type="button" onClick={() => void loadMore()} className="btn-ghost">
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
