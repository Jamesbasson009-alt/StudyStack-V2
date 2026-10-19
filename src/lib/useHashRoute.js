import { useEffect, useState } from 'react';

// Views reachable via a URL hash, independent of sign-in state, so a shared or bookmarked
// #terms / #privacy link opens straight to that page.
const HASH_VIEWS = ['generator', 'terms', 'privacy', 'books'];
// Friendly aliases: #textbooks opens the marketplace, same as #books.
const HASH_ALIASES = { textbooks: 'books' };
const resolveHash = (raw) => HASH_ALIASES[raw] || raw;

function initialView() {
  if (typeof window === 'undefined') return 'landing';
  // A friend's share link looks like /?friend=CODE with no hash. It must open the app
  // (sign-in first if needed), not the landing page.
  if (new URLSearchParams(window.location.search).has('friend')) return 'generator';
  const hash = resolveHash(window.location.hash.replace('#', ''));
  return HASH_VIEWS.includes(hash) ? hash : 'landing';
}

export function useHashRoute() {
  const [currentView, setCurrentView] = useState(initialView);

  const navigateTo = (view) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      window.location.hash = `#${view}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Keep the hash in step with the friend-link view so a refresh stays in the app.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('friend') && !url.hash) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}#generator`);
    }
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = resolveHash(window.location.hash.replace('#', ''));
      if (HASH_VIEWS.includes(hash)) setCurrentView(hash);
      else if (hash === 'landing' || hash === '') setCurrentView('landing');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return { currentView, navigateTo };
}
