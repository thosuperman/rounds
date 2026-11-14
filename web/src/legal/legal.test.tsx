import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LegalPage } from './LegalPage';
import { SiteFooter } from './SiteFooter';
import { PAGES } from './content';
import { LAST_UPDATED, LEGAL_PAGES, legalRoute } from './routes';

const html = (page: 'terms' | 'privacy' | 'disclaimer') => renderToStaticMarkup(<LegalPage page={page} />);
const text = (page: 'terms' | 'privacy' | 'disclaimer') => html(page).replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('legal routes', () => {
  it('maps the three paths, with or without a trailing slash, and nothing else', () => {
    expect(legalRoute('/terms')).toBe('terms');
    expect(legalRoute('/privacy/')).toBe('privacy');
    expect(legalRoute('/Disclaimer')).toBe('disclaimer');
    expect(legalRoute('/')).toBeNull();
    expect(legalRoute('/terms/extra')).toBeNull();
  });

  for (const { id, label } of LEGAL_PAGES) {
    it(`renders /${id} with its title, date, contents and footer links`, () => {
      const h = html(id);
      expect(h).toContain(`<h1>${label}</h1>`);
      expect(h).toContain(`Last updated: ${LAST_UPDATED}`);
      for (const s of PAGES[id].sections) {
        expect(h).toContain(`href="#${s.id}"`);
        expect(h).toContain(`id="${s.id}"`);
      }
      for (const p of LEGAL_PAGES) expect(h).toContain(`href="${p.path}"`);
      expect(h).toContain('mailto:hello@hayaix.tech');
      expect(h).toContain('https://hayaix.tech/terms');
    });
  }
});

describe('footer', () => {
  it('links to all three legal pages', () => {
    const h = renderToStaticMarkup(<SiteFooter />);
    for (const p of LEGAL_PAGES) expect(h).toContain(`<a href="${p.path}">${p.label}</a>`);
  });

  it('is used on every app screen (main view, loading and error)', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(app.match(/<SiteFooter \/>/g)?.length).toBe(3);
  });
});

describe('content', () => {
  it('terms: as-is, at own risk, Apache-2.0, Japanese law, mandatory-law carve-out', () => {
    const t = text('terms');
    for (const s of ['"AS IS"', '"AS AVAILABLE"', 'at your own risk', 'Apache License, Version 2.0', 'laws of Japan', 'Consumer Contract Act', 'gross negligence', 'App Check'])
      expect(t).toContain(s);
  });

  it('privacy: names every data flow found in the code', () => {
    const t = text('privacy');
    for (const s of ['Anonymous Authentication', 'Cloud Firestore', 'asia-northeast1', 'reCAPTCHA', 'Remote Config', 'Gemini Nano', 'Cloud fallback', 'Hybrid ledger', 'human reviewers', 'rounds.cloudFallbackConsent', 'rounds.packcache.', 'rounds.manualcache.', 'IndexedDB', 'APPI', 'Google Analytics'])
      expect(t).toContain(s);
  });

  it('disclaimer: not certified, fictional manual, AI can be wrong, desktop Chrome', () => {
    const t = text('disclaimer');
    for (const s of ['not certified', 'fictional', 'can be wrong', 'desktop version of Chrome', '/terms#liability']) expect(t + html('disclaimer')).toContain(s);
  });

  it('states no compensation amount or monetary cap', () => {
    for (const p of LEGAL_PAGES) expect(text(p.id)).not.toMatch(/[¥$€]\s?\d|\d\s?(yen|JPY|USD|dollars)/i);
  });
});
