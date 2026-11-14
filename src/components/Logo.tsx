// The PulseHive logo: a heartbeat line. One drawing, used everywhere.

// Just the line. Takes its colour from the text colour around it and scales with the text size.
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg width="1.1em" height="0.63em" viewBox="0 0 28 16" fill="none" aria-hidden="true" className={className}>
      <path d="M1 9h6l3-7 4 12 3-8 2 3h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The app icon: the line on a dark rounded square. Same picture as the website icon and the phone app icon.
export function LogoIcon({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#0B1020" />
      <path d="M8.3 33.8H19.3L24.7 21.1L32 42.9L37.5 28.4L41.1 33.8H55.7" fill="none" stroke="#FF6B9C" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
