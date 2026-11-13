import type { ReactNode } from 'react';
import type { InferenceSourceLabel, Level } from '../domain/types';

export function SourceBadge({ source, ms, model }: { source: InferenceSourceLabel; ms?: number; model?: string }) {
  const label = {
    ON_DEVICE: 'On-device',
    IN_CLOUD: 'Cloud',
    DETERMINISTIC: 'Rule-based',
    QUEUED: 'Queued for cloud',
    NONE: 'Not run',
  }[source];
  return (
    <span className={`badge src-${source}`} title={model}>
      <span className="dot" />
      {label}
      {ms != null ? ` · ${(ms / 1000).toFixed(1)}s` : ''}
    </span>
  );
}

export function LevelBadge({ level, big }: { level: Level; big?: boolean }) {
  const text = { ok: 'Within limits', attention: 'Attention', alarm: 'ALARM' }[level];
  return <span className={`level level-${level} ${big ? 'level-big' : ''}`}>{text}</span>;
}

export function Card({ title, right, children, tone }: { title?: ReactNode; right?: ReactNode; children: ReactNode; tone?: 'ai' | 'rule' | 'warn' | 'alarm' }) {
  return (
    <section className={`card ${tone ? `card-${tone}` : ''}`}>
      {(title || right) && (
        <header className="card-h">
          <h3>{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Tag({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`tag ${tone ? `tag-${tone}` : ''}`}>{children}</span>;
}

export function time(ts?: number) {
  if (!ts) return '–';
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
