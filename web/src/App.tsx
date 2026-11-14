import { useEffect, useState } from 'react';
import { loadRemoteConfig } from './firebase';
import { startSession, type Session } from './data/workspace';
import { useDeviceModel, useLive, useOnline } from './hooks';
import { cloudFallbackAllowed, prepareDeviceModel, setCloudFallbackAllowed } from './ai/hybrid';
import { drainQueue } from './ai/escalation';
import { onSyncState, watchEscalations } from './data/repo';
import type { Escalation } from './domain/types';
import { Supervisor } from './views/Supervisor';
import { Field } from './views/Field';
import { Handovers } from './views/Handovers';
import { Ledger } from './views/Ledger';
import { SiteFooter } from './legal/SiteFooter';

type Tab = 'field' | 'supervisor' | 'handovers' | 'ledger';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('rounds.tab') as Tab) || 'supervisor');
  useEffect(() => {
    void loadRemoteConfig();
    return startSession(setSession, (e) => setErr(String(e)));
  }, []);
  useEffect(() => localStorage.setItem('rounds.tab', tab), [tab]);

  if (err)
    return (
      <>
        <p className="error pad">Could not sign in: {err}</p>
        <SiteFooter />
      </>
    );
  if (!session)
    return (
      <>
        <p className="pad muted">Starting Rounds…</p>
        <SiteFooter />
      </>
    );
  return (
    <div className="app">
      <TopBar />
      <QueueWorker />
      <nav className="tabs" role="tablist">
        {(
          [
            ['field', 'Technician'],
            ['supervisor', 'Supervisor'],
            ['handovers', 'Handover'],
            ['ledger', 'Hybrid ledger'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'field' && <Field session={session} onHandover={() => setTab('handovers')} />}
        {tab === 'supervisor' && <Supervisor session={session} />}
        {tab === 'handovers' && <Handovers session={session} />}
        {tab === 'ledger' && <Ledger />}
      </main>
      <SiteFooter />
    </div>
  );
}

function TopBar() {
  const online = useOnline();
  const [device, setDevice] = useDeviceModel();
  const [progress, setProgress] = useState<number | null>(null);
  const label =
    device === 'available'
      ? 'On-device AI ready'
      : device === 'downloadable'
        ? 'On-device AI: download'
        : device === 'downloading'
          ? 'On-device AI downloading…'
          : device === 'checking'
            ? 'Checking device…'
            : 'No on-device AI · cloud only';
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">◎</span> Rounds
      </div>
      <div className="row gap">
        <span className={`pill ${online ? 'pill-on' : 'pill-off'}`}>{online ? 'Online' : 'Offline'}</span>
        <SyncPill />
        <button
          className={`pill ${device === 'available' ? 'pill-on' : 'pill-neutral'}`}
          disabled={device !== 'downloadable' && device !== 'downloading'}
          title="The on-device model download needs a click (Chrome user activation)."
          onClick={async () => {
            setProgress(0);
            try {
              await prepareDeviceModel((p) => setProgress(p));
              setDevice('available');
            } finally {
              setProgress(null);
            }
          }}
        >
          {progress != null ? `Downloading ${Math.round(progress * 100)}%` : label}
        </button>
        {device !== 'available' && device !== 'checking' && <FallbackToggle />}
      </div>
    </header>
  );
}

/** Drains consented cloud escalations whenever we are online. */
function QueueWorker() {
  const online = useOnline();
  const esc = useLive<Escalation>(watchEscalations);
  const pendingKey = esc
    .filter((e) => e.status === 'queued' || e.status === 'running')
    .map((e) => e.id)
    .join(',');
  useEffect(() => {
    if (!online || !pendingKey) return;
    void drainQueue(esc);
    // Short interval: right after reconnecting, a queued doc may not have reached the server yet
    // (claim() then finds nothing), so retry quickly while work is pending.
    const t = setInterval(() => void drainQueue(esc), 5_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pendingKey]);
  return null;
}

/** Opt-in for sending device tasks (notes, questions, handover facts) to the cloud model. */
function FallbackToggle() {
  const [on, setOn] = useState(cloudFallbackAllowed());
  return (
    <button
      className={`pill ${on ? 'pill-on' : 'pill-neutral'}`}
      title="Without a local model, checking notes, answering questions and writing handovers needs the cloud."
      onClick={() => {
        if (!on && !window.confirm('Allow notes, questions and handover facts from this device to be sent to the Gemini cloud model through Firebase AI Logic? You can turn this off again.')) return;
        setCloudFallbackAllowed(!on);
        setOn(!on);
      }}
    >
      {on ? 'Cloud fallback: on' : 'Cloud fallback: off'}
    </button>
  );
}

/** Real Firestore sync state: unacknowledged writes are changes kept on this device. */
function SyncPill() {
  const [pending, setPending] = useState(0);
  useEffect(() => onSyncState(setPending), []);
  return (
    <span className={`pill ${pending ? 'pill-neutral' : 'pill-on'}`} title="Changes saved on this device and not yet confirmed by the server">
      {pending ? `Saved on device · ${pending} to sync` : 'Synced'}
    </span>
  );
}
