'use client';
// Light/dark toggle for the editor — same data-theme + localStorage 'theme' key the
// public ThemeToggle uses, so the choice is shared. The no-flash script in layout.tsx
// already applies the stored theme before paint, including on /admin.
import { useEffect, useState } from 'react';

export function useAdminTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  };
  return { theme, toggle };
}
