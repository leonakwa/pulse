import { headers } from 'next/headers';

// The address people are sent back to from emails (confirmation, password reset, email change).
// Uses NEXT_PUBLIC_SITE_URL when it is set to a real address. If it is missing or still says localhost,
// it falls back to the address the person is actually using, so the links never point at the wrong place.
export async function getSiteUrl(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '');
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return configured || 'http://localhost:3000';

  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = isLocal ? 'http' : (h.get('x-forwarded-proto') ?? 'https');
  return `${proto}://${host}`;
}
