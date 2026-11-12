'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import type { PostView } from '@/lib/posts';

export function SinglePost({ post: initial, currentUserId }: { post: PostView; currentUserId: string }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);

  return (
    <PostCard
      post={post}
      isOwn={post.author.id === currentUserId}
      currentUserId={currentUserId}
      defaultShowComments
      onDeleted={() => router.replace('/feed')}
      onUpdated={(_id, body, editedAt) => setPost((p) => ({ ...p, body, editedAt }))}
    />
  );
}
