import React from 'react';

const VIEW_TO_PATH = {
  landing: '/',
  books: '/books',
  terms: '/terms',
  privacy: '/privacy',
  auth: '/login',
  generator: '/generator',
  guide: '/guide/up-timetable-pdf',
};

export function NavLink({ view, onNavigate, children, className, style, ...rest }) {
  const href = VIEW_TO_PATH[view] || '/';
  return (
    <a
      href={href}
      className={className}
      style={{ textDecoration: 'none', ...style }}
      onClick={(e) => {
        // Allow modifier-key clicks (open in new tab) to work normally
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate?.(view);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
