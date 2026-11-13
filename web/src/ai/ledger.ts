// The hybrid ledger: an append-only record of every inference the app attempted, with the
// backend that actually ran it (as reported by the SDK). Stored in Firestore (works offline
// via the persistent cache) and mirrored in memory for the live UI.

import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import type { InferenceSourceLabel } from '../domain/types';
import { currentWorkspace } from '../data/workspace';

export interface LedgerEvent {
  task: string;
  mode: string;
  source: InferenceSourceLabel;
  ms: number;
  ok: boolean;
  error?: string;
  model?: string;
  escalationReason?: string;
  roundId?: string;
  stepId?: string;
  at?: number;
  online?: boolean;
}

type Listener = (events: LedgerEvent[]) => void;
const events: LedgerEvent[] = [];
const listeners = new Set<Listener>();

export function onLedger(l: Listener) {
  listeners.add(l);
  l(events);
  return () => listeners.delete(l);
}

export async function recordInference(e: LedgerEvent) {
  const ev = { ...e, at: Date.now(), online: navigator.onLine };
  events.unshift(ev);
  if (events.length > 200) events.pop();
  listeners.forEach((l) => l([...events]));
  const ws = currentWorkspace();
  if (!ws) return;
  // Fire-and-forget: with the persistent cache this resolves locally when offline.
  addDoc(collection(db, 'workspaces', ws, 'ledger'), clean(ev)).catch(() => undefined);
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
