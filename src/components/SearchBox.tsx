'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { initial: string; basePath?: string; label?: string };

// Searches as you type (after a short pause), or when you press enter.
export function SearchBox({ initial, basePath = '/discover', label = 'Search people by name or username' }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const first = useRef(true);

  const go = (v: string) => {
    const q = v.trim();
    router.replace(q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath);
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
      <label htmlFor="people-search" className="sr-only">
        {label}
      </label>
      <input
        id="people-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={50}
        autoComplete="off"
        autoCapitalize="none"
        placeholder={label}
        className="input"
      />
    </form>
  );
}
