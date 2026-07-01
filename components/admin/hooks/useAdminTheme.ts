'use client';
// Light/dark toggle for the editor — same data-theme + localStorage 'theme' key the
// public ThemeToggle uses, so the choice is shared. The no-flash script in layout.tsx
// already applies the stored theme before paint, including on /admin.
import { useEffect, useState } from 'react';
import { applyTheme } from '@/lib/theme';

export function useAdminTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return { theme, toggle };
}
