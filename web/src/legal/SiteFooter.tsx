import { LEGAL_PAGES } from './routes';

/** Footer shown on every screen: the safety note plus links to the three legal pages. */
export function SiteFooter({ current }: { current?: string }) {
  return (
    <footer className="site-footer muted small">
      <p>
        Rounds · demo with fictional equipment · AI suggestions are advisory; approved limits are enforced by rules · not
        certified for industrial safety use
      </p>
      <nav aria-label="Legal" className="legal-links">
        {LEGAL_PAGES.map((p) => (
          <a key={p.id} href={p.path} aria-current={current === p.id ? 'page' : undefined}>
            {p.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
