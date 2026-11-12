'use client';

import { useEffect, useState } from 'react';

// Shows the time in the viewer's own timezone (worked out in the browser, so it is always right).
export function ClientTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState('');

  useEffect(() => {
    const d = new Date(iso);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sameDay = d.toDateString() === new Date().toDateString();
    setText(sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`);
  }, [iso]);

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
