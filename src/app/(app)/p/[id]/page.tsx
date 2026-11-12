import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPostById } from '@/lib/posts';
import { SinglePost } from '@/components/SinglePost';

export const metadata: Metadata = { title: 'Post' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const post = await getPostById(supabase, id, me.id);
  if (!post) notFound();

  return (
    <div>
      <Link href="/feed" className="text-sm font-medium text-muted hover:text-fg">
        ← Home
      </Link>
      <h1 className="sr-only">Post by {post.author.fullName}</h1>
      <div className="mt-2">
        <SinglePost post={post} currentUserId={me.id} />
      </div>
    </div>
  );
}
