// The picture for a group chat: a circle with a "people" icon.
export function GroupAvatar({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand ${className}`}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M17.5 14.5c2.4.2 4 1.7 4 4.5" />
      </svg>
    </span>
  );
}
