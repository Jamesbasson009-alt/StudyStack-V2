import { useEffect } from 'react';

const SITE = 'https://studystack.me';
const OG_IMAGE = `${SITE}/studystack-logo.png`;

function upsert(selector, tag, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}

function meta(key, name, content) {
  upsert(`meta[${key}="${name}"]`, 'meta', { [key]: name, content });
}

export function useSeo({ title, description, path = '/', noindex = false, image = OG_IMAGE }) {
  useEffect(() => {
    const url = SITE + path;

    document.title = title;

    meta('name', 'description', description);
    meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: url });

    meta('property', 'og:type', 'website');
    meta('property', 'og:site_name', 'StudyStack');
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:url', url);
    meta('property', 'og:image', image);

    meta('name', 'twitter:card', 'summary_large_image');
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', description);
    meta('name', 'twitter:image', image);
  }, [title, description, path, noindex, image]);
}
