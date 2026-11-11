import type { Metadata } from 'next';
import { FollowList } from '@/components/FollowList';

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `Followers of @${username}` };
}

export default async function FollowersPage({ params, searchParams }: Props) {
  const { username } = await params;
  const { page } = await searchParams;
  return <FollowList username={username} kind="followers" page={Math.max(1, Math.floor(Number(page)) || 1)} />;
}
