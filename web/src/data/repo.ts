// Firestore access. All writes go through the persistent local cache, so they succeed offline
// and sync when connectivity returns. Approved packs are immutable (also enforced by rules).

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { currentWorkspace } from './workspace';
import type { Entry, Escalation, Handover, Issue, IssueOccurrence, Level, ProcedurePack, Round } from '../domain/types';
import { worse } from '../domain/measure';

function ws() {
  const w = currentWorkspace();
  if (!w) throw new Error('Not signed in');
  return w;
}
const col = (...path: string[]) => collection(db, 'workspaces', ws(), ...(path as [string]));
const ref = (...path: string[]) => doc(db, 'workspaces', ws(), ...(path as [string]));

/**
 * Firestore write promises resolve only when the server acknowledges, so offline they would hang.
 * Writes are applied to the local cache immediately; we never block the UI on them.
 */
// Writes resolve only when the server acknowledges them, so the number of unresolved writes is the
// real count of changes saved on this device but not yet synced. The top bar shows it.
let pendingWrites = 0;
const syncListeners = new Set<(n: number) => void>();
function emitSync() {
  for (const l of syncListeners) l(pendingWrites);
}
export function onSyncState(cb: (pending: number) => void) {
  syncListeners.add(cb);
  cb(pendingWrites);
  return () => {
    syncListeners.delete(cb);
  };
}

export function fire(p: Promise<unknown>) {
  pendingWrites++;
  emitSync();
  p.catch((e) => console.warn('[firestore] write rejected', e)).finally(() => {
    pendingWrites--;
    emitSync();
  });
}

/** Firestore rejects undefined; strip it deeply. */
export function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function live<T>(q: Parameters<typeof onSnapshot>[0], cb: (rows: T[]) => void) {
  return onSnapshot(q as never, { includeMetadataChanges: true }, (snap: { docs: { id: string; data(): DocumentData; metadata: { hasPendingWrites: boolean } }[] }) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id, _pending: d.metadata.hasPendingWrites }))),
  );
}

// ---------------------------------------------------------------- packs

export function watchPacks(cb: (p: ProcedurePack[]) => void) {
  return live<ProcedurePack>(query(col('packs'), orderBy('provenance.compiledAt', 'desc')), cb);
}
export async function savePack(p: ProcedurePack) {
  fire(setDoc(ref('packs', p.id), clean(p)));
}
export async function getPack(id: string) {
  const s = await getDoc(ref('packs', id));
  return s.exists() ? ({ ...(s.data() as ProcedurePack), id: s.id } as ProcedurePack) : null;
}
export async function saveManual(packId: string, text: string) {
  fire(setDoc(ref('manuals', packId), { text }));
}
export async function getManual(packId: string) {
  const s = await getDoc(ref('manuals', packId));
  return s.exists() ? (s.data().text as string) : '';
}
export async function approvePack(id: string, approvedItems: string[], excludedItems: string[], approvedBy: string) {
  fire(updateDoc(ref('packs', id), { status: 'approved', approval: { approvedItems, excludedItems, approvedBy, approvedAt: Date.now() } }));
}
export async function setDraftReview(id: string, approved: string[], excluded: string[]) {
  fire(updateDoc(ref('packs', id), { draftApprovals: approved, draftExcluded: excluded }));
}
export async function retirePack(id: string) {
  fire(updateDoc(ref('packs', id), { status: 'retired' }));
}

// ---------------------------------------------------------------- rounds & entries

export function watchRounds(cb: (r: Round[]) => void) {
  return live<Round>(query(col('rounds'), orderBy('createdAt', 'desc')), cb);
}
export async function saveRound(r: Round) {
  fire(setDoc(ref('rounds', r.id), clean(r)));
}
export async function updateRound(id: string, patch: Partial<Round>) {
  fire(updateDoc(ref('rounds', id), clean(patch) as DocumentData));
}
export function watchEntries(roundId: string, cb: (e: (Entry & { id: string })[]) => void) {
  return live<Entry & { id: string }>(col('rounds', roundId, 'entries'), cb);
}
export async function saveEntry(roundId: string, e: Entry) {
  fire(setDoc(ref('rounds', roundId, 'entries', e.stepId), clean(e)));
}

// ---------------------------------------------------------------- issues (cross-shift)

export function watchIssues(cb: (i: Issue[]) => void) {
  return live<Issue>(query(col('issues'), orderBy('lastSeen', 'desc')), cb);
}
export async function listOpenIssues(equipmentId: string) {
  const s = await getDocs(query(col('issues'), where('equipmentId', '==', equipmentId), where('status', '==', 'open')));
  return s.docs.map((d) => ({ ...(d.data() as Issue), id: d.id }));
}

/** Record an occurrence. Idempotent per round+step: re-recording replaces nothing, arrayUnion de-duplicates exact copies. */
export async function recordIssue(
  base: Pick<Issue, 'equipmentId' | 'stepId' | 'stepTitle'>,
  occ: IssueOccurrence,
  known?: Issue,
) {
  const id = `${base.equipmentId}__${base.stepId}`;
  let existing = known;
  if (!existing) {
    // Served from the local cache when offline.
    const s = await getDoc(ref('issues', id)).catch(() => null);
    existing = s?.exists() ? ({ ...(s.data() as Issue), id } as Issue) : undefined;
  }
  if (existing && existing.status === 'open') {
    if (existing.occurrences.some((o) => o.roundId === occ.roundId)) {
      // Replace this round's occurrence (value corrected) without duplicating.
      const occurrences = existing.occurrences.map((o) => (o.roundId === occ.roundId ? occ : o));
      fire(updateDoc(ref('issues', id), clean({ occurrences, lastSeen: occ.at, worstLevel: occurrences.reduce<Level>((a, o) => worse(a, o.level), 'ok') }) as DocumentData));
      return;
    }
    fire(updateDoc(ref("issues", id), { occurrences: arrayUnion(clean(occ)), lastSeen: occ.at, worstLevel: worse(existing.worstLevel, occ.level) }));
    return;
  }
  const issue: Issue = { ...base, id, status: 'open', worstLevel: occ.level, occurrences: [occ], firstSeen: occ.at, lastSeen: occ.at };
  fire(setDoc(ref('issues', id), clean(issue)));
}
export async function resolveIssue(id: string, by: string) {
  fire(updateDoc(ref('issues', id), { status: 'resolved', resolvedBy: by, resolvedAt: Date.now() }));
}

// ---------------------------------------------------------------- escalations

export function watchEscalations(cb: (e: Escalation[]) => void) {
  return live<Escalation>(query(col('escalations'), orderBy('createdAt', 'desc')), cb);
}
export async function getEscalation(id: string) {
  const s = await getDoc(ref('escalations', id));
  return s.exists() ? ({ ...(s.data() as Escalation), id: s.id } as Escalation) : null;
}
export function escalationRef(id: string) {
  return ref('escalations', id);
}

// ---------------------------------------------------------------- handovers

export function watchHandovers(cb: (h: Handover[]) => void) {
  return live<Handover>(query(col('handovers'), orderBy('createdAt', 'desc')), cb);
}
export async function saveHandover(h: Handover) {
  fire(setDoc(ref('handovers', h.id), clean(h)));
}
export async function acknowledgeHandover(id: string, by: string) {
  fire(updateDoc(ref('handovers', id), { acknowledgedBy: by, acknowledgedAt: Date.now() }));
}
