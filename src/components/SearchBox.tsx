'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Searches as you type (after a short pause), or when you press enter.
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const first = useRef(true);

  const go = (v: string) => {
    const q = v.trim();
    router.replace(q ? `/discover?q=${encodeURIComponent(q)}` : '/discover');
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => go(value), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <label htmlFor="discover-search" className="sr-only">
        Search people
      </label>
      <input
        id="discover-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={50}
        autoComplete="off"
        autoCapitalize="none"
        placeholder="Search people by name or username"
        className="input"
      />
    </form>
  );
}
