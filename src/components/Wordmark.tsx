export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight ${className}`}>
      <svg width="30" height="18" viewBox="0 0 28 16" fill="none" aria-hidden="true" className="text-brand">
        <path d="M1 9h6l3-7 4 12 3-8 2 3h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      pulse
    </span>
  );
}
