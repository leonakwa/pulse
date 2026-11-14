import { LogoMark } from '@/components/Logo';

// The name, written as one word. "pulse" in the text colour and "hive" in the brand colour, with no gap between them.
export function Wordmark({ className = '', showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight ${className}`}>
      {showMark ? <LogoMark className="text-brand" /> : null}
      <span>
        pulse<span className="text-brand">hive</span>
      </span>
    </span>
  );
}
