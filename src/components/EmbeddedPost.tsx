import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/time';
import type { SharedPostView } from '@/lib/posts';

// The original post shown inside a share, with its author credited and a link back to it.
export function EmbeddedPost({ post }: { post: SharedPostView | null }) {
  if (!post) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm text-muted">This post is no longer available.</div>
    );
  }
  return (
    <Link href={`/p/${post.id}`} className="mt-3 block rounded-xl border border-line p-3 hover:bg-surface">
      <div className="flex items-center gap-2">
        <Avatar name={post.author.fullName} url={post.author.avatarUrl} size={24} />
        <p className="min-w-0 truncate text-sm">
          <span className="font-semibold">{post.author.fullName}</span>{' '}
          <span className="text-muted">
            @{post.author.username} ·{' '}
            <time dateTime={post.createdAt} suppressHydrationWarning>
              {timeAgo(post.createdAt)}
            </time>
          </span>
        </p>
      </div>
      {post.body ? <p className="mt-2 line-clamp-6 whitespace-pre-line break-words text-[15px]">{post.body}</p> : null}
      {post.images.length > 0 ? (
        <div className={`mt-2 grid gap-1 overflow-hidden rounded-lg ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={`Photo ${i + 1} from ${post.author.fullName}`}
              loading="lazy"
              decoding="async"
              className={post.images.length === 1 ? 'max-h-72 w-full object-cover' : 'aspect-square w-full object-cover'}
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}
