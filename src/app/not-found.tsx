import Link from 'next/link';
import { LogoIcon } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <LogoIcon size={64} />
      <h1 className="mt-6 font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for does not exist, or it may have been removed.</p>
      <Link href="/" className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg">
        Go to PulseHive
      </Link>
    </main>
  );
}
