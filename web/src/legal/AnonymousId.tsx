import { useState } from 'react';

/**
 * Shows the anonymous ID stored in this browser, so a privacy request can be matched to a workspace.
 * Firebase is loaded only when the button is pressed, and no account is created.
 */
export function AnonymousId() {
  const [state, setState] = useState<'idle' | 'loading' | 'none' | 'error' | string>('idle');
  if (state === 'idle' || state === 'loading')
    return (
      <button
        className="btn"
        disabled={state === 'loading'}
        onClick={async () => {
          setState('loading');
          try {
            const { storedAnonymousId } = await import('./whoami');
            setState((await storedAnonymousId()) ?? 'none');
          } catch {
            setState('error');
          }
        }}
      >
        {state === 'loading' ? 'Reading…' : 'Show my anonymous ID'}
      </button>
    );
  if (state === 'none') return <p className="callout">This browser has no Rounds account. Rounds holds no data for it.</p>;
  if (state === 'error') return <p className="callout">The ID could not be read here. Open Rounds in this browser and try again.</p>;
  return (
    <p className="callout">
      Your anonymous ID in this browser: <code className="anon-id">{state}</code>
    </p>
  );
}
