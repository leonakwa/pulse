import Link from 'next/link';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { deletePostAsAdmin } from '@/lib/admin-actions';
import { fmtDateTime } from '@/lib/admin';

export type AdminPost = {
  id: string;
  author_id: string;
  username: string;
  full_name: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  image_paths: string[];
};

export function AdminPostItem({ post, images, returnTo }: { post: AdminPost; images: string[]; returnTo: string }) {
  return (
    <li className="rounded-2xl border border-line p-4">
      <p className="text-sm">
        <Link href={`/admin/users/${post.author_id}`} className="font-semibold hover:underline">
          {post.full_name}
        </Link>{' '}
        <span className="text-muted">@{post.username} · {fmtDateTime(post.created_at)}</span>
      </p>
      {post.body ? <p className="mt-2 whitespace-pre-line break-words">{post.body}</p> : <p className="mt-2 text-sm italic text-muted">(photo only)</p>}
      {images.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-1 overflow-hidden rounded-xl">
          {images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="Post photo" loading="lazy" className="aspect-square w-full object-cover" />
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {post.like_count} likes · {post.comment_count} comments ·{' '}
        <Link href={`/p/${post.id}`} className="font-semibold text-brand">
          Open post
        </Link>
      </p>

      <form action={deletePostAsAdmin} className="mt-3 flex gap-2">
        <input type="hidden" name="postId" value={post.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label htmlFor={`reason-${post.id}`} className="sr-only">
          Reason for removing this post
        </label>
        <input id={`reason-${post.id}`} name="reason" required minLength={3} maxLength={300} placeholder="Reason for removing" className="input !py-2" />
        <ConfirmButton message="Delete this post permanently? This cannot be undone." className="shrink-0 rounded-full border border-danger/50 px-4 text-sm font-semibold text-danger hover:bg-danger/10">
          Delete
        </ConfirmButton>
      </form>
    </li>
  );
}
