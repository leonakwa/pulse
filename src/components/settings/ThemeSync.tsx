'use client';

import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';

// Your saved choice (from your account) wins, so the same theme follows you to a new phone or browser.
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return null;
}
