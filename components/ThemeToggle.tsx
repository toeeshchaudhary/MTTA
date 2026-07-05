'use client';
import { useEffect, useState } from 'react';
import { applyTheme } from '@/lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  useEffect(() => {
    const cur = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'light';
    setTheme(cur);
  }, []);
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setTheme(next);
  };
  return (
    <button className="tt" onClick={toggle} aria-label="Toggle theme">
      theme: {theme === 'dark' ? 'black' : 'paper'}
      <style jsx>{`
        .tt { margin-top: 8px; font-family: var(--font-sans); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em;
          background: none; border: 2px solid var(--ink); color: var(--ink); padding: 5px 8px; cursor: pointer; }
        .tt:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      `}</style>
    </button>
  );
}
