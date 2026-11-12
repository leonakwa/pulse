import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { MessageButton } from '@/components/MessageButton';
import type { Person } from '@/components/PersonRow';

export function MessageRow({ person }: { person: Person }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/u/${person.username}`} aria-label={`${person.full_name}'s profile`}>
        <Avatar name={person.full_name} url={person.avatar_url} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{person.full_name}</p>
        <p className="truncate text-sm text-muted">@{person.username}</p>
      </div>
      <MessageButton userId={person.id} />
    </li>
  );
}
