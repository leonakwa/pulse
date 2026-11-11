import type { CSSProperties } from 'react';

type Props = { name: string; url?: string | null; size?: number; className?: string };

// Shows the profile picture, or the person's initials until one is uploaded.
export function Avatar({ name, url, size = 40, className = '' }: Props) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  const style: CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name}'s profile picture`}
        width={size}
        height={size}
        loading="lazy"
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand/15 font-display font-bold text-brand ${className}`}
    >
      {initials}
    </span>
  );
}
