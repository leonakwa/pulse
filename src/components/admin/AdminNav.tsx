'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users', exact: false },
  { href: '/admin/posts', label: 'Posts', exact: false },
  { href: '/admin/activity', label: 'Activity', exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${active ? 'bg-brand text-brand-fg' : 'text-muted hover:text-fg'}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
