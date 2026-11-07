import { useCallback, useEffect, useState } from 'react';

const PATH_TO_VIEW = {
  '/': 'landing',
  '/books': 'books',
  '/terms': 'terms',
  '/privacy': 'privacy',
  '/login': 'auth',
  '/generator': 'generator',
};
const VIEW_TO_PATH = Object.fromEntries(
  Object.entries(PATH_TO_VIEW).map(([p, v]) => [v, p])
);

// Hash alias so old /#textbooks links still work.
const HASH_ALIASES = { textbooks: 'books' };

const read = () =>
  PATH_TO_VIEW[window.location.pathname.replace(/\/+$/, '') || '/'] ?? 'landing';

export function useHashRoute() {
  const [currentView, setCurrentView] = useState(() => {
    // Friend share links: /?friend=CODE → generator
    if (new URLSearchParams(window.location.search).has('friend')) return 'generator';

    // Migrate legacy hash links: /#books → /books
    const rawHash = window.location.hash.slice(1);
    const legacy = HASH_ALIASES[rawHash] || rawHash;
    if (VIEW_TO_PATH[legacy] && legacy !== 'landing') {
      window.history.replaceState(null, '', VIEW_TO_PATH[legacy]);
      return legacy;
    }

    return read();
  });

  useEffect(() => {
    const onPop = () => setCurrentView(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateTo = useCallback((view) => {
    const path = VIEW_TO_PATH[view] ?? '/';
    if (path !== window.location.pathname) {
      window.history.pushState(null, '', path);
    }
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  return { currentView, navigateTo };
}
