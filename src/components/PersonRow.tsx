import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';

export type Person = {
  id: string;
  username: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_following?: boolean;
};

export function PersonRow({ person, viewerId }: { person: Person; viewerId: string }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/u/${person.username}`} aria-label={`${person.full_name}'s profile`}>
        <Avatar name={person.full_name} url={person.avatar_url} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${person.username}`} className="block truncate font-semibold hover:underline">
          {person.full_name}
        </Link>
        <p className="truncate text-sm text-muted">@{person.username}</p>
        {person.bio ? <p className="mt-0.5 line-clamp-1 text-sm">{person.bio}</p> : null}
      </div>
      {person.id !== viewerId ? <FollowButton targetId={person.id} initialFollowing={Boolean(person.is_following)} /> : null}
    </li>
  );
}
