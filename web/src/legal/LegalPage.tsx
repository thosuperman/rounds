import { useEffect } from 'react';
import { SiteFooter } from './SiteFooter';
import { LAST_UPDATED, LEGAL_PAGES, type LegalPageId } from './routes';
import { PAGES } from './content';
export type { LegalDoc, LegalSection } from './types';

/** A standalone legal page. It does not start Firebase, sign-in or reCAPTCHA. */
export function LegalPage({ page }: { page: LegalPageId }) {
  const doc = PAGES[page];
  useEffect(() => {
    document.title = `${doc.title} · Rounds`;
    // The page renders after the browser's own anchor jump, so jump to #section here.
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [doc.title]);
  return (
    <div className="legal">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="logo">◎</span> Rounds
        </a>
        <a className="pill pill-neutral" href="/">
          Back to Rounds
        </a>
      </header>
      <nav aria-label="Legal documents" className="legal-tabs">
        {LEGAL_PAGES.map((p) => (
          <a key={p.id} href={p.path} className={p.id === page ? 'on' : ''} aria-current={p.id === page ? 'page' : undefined}>
            {p.label}
          </a>
        ))}
      </nav>
      <main className="legal-main">
        <h1>{doc.title}</h1>
        <p className="muted small">Last updated: {LAST_UPDATED} · applies to Rounds (rounds.hayaix.tech) only · English</p>
        <div className="legal-lead">{doc.lead}</div>
        {doc.summary && (
          <section className="legal-summary" aria-label="Summary">
            {doc.summary}
          </section>
        )}
        <nav aria-label="Contents" className="legal-toc">
          <h2>Contents</h2>
          <ol>
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="legal-section">
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </main>
      <SiteFooter current={page} />
    </div>
  );
}
