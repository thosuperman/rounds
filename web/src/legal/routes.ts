// Legal pages are plain URL routes (/terms, /privacy, /disclaimer). Firebase Hosting rewrites every
// path to index.html and the service worker falls back to it offline, so main.tsx picks the page
// from location.pathname.

export type LegalPageId = 'terms' | 'privacy' | 'disclaimer';

export const LEGAL_PAGES: { id: LegalPageId; path: string; label: string }[] = [
  { id: 'terms', path: '/terms', label: 'Terms of Service' },
  { id: 'privacy', path: '/privacy', label: 'Privacy Policy' },
  { id: 'disclaimer', path: '/disclaimer', label: 'Disclaimer' },
];

/** The legal page for a URL path, or null for the app itself. Tolerates a trailing slash. */
export function legalRoute(pathname: string): LegalPageId | null {
  const p = pathname.replace(/\/+$/, '').toLowerCase();
  return LEGAL_PAGES.find((x) => x.path === p)?.id ?? null;
}

/** Publication date of the current versions (the day they were deployed). */
export const LAST_UPDATED = '15 November 2026';
export const CONTACT_EMAIL = 'hello@hayaix.tech';
