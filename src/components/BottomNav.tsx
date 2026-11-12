'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav({ profilePath }: { profilePath: string }) {
  const pathname = usePathname();

  const items = [
    {
      href: '/feed',
      label: 'Home',
      active: pathname === '/feed',
      icon: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    },
    {
      href: '/discover',
      label: 'Discover',
      active: pathname.startsWith('/discover'),
      icon: (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      ),
    },
    {
      href: profilePath,
      label: 'Profile',
      active: pathname.startsWith('/u/') || pathname.startsWith('/settings'),
      icon: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </>
      ),
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${item.active ? 'text-brand' : 'text-muted'}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {item.icon}
            </svg>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
