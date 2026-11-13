// Application-level escalation + offline queue.
//
// An escalation is created only after the technician has seen the exact payload and consented.
// Its id is a hash of (round, step, reason, payload), so creating it twice is a no-op, and the
// Firestore rules forbid moving a "done" escalation back to "queued".
// Processing claims the item with a transaction + short lease, so two tabs/devices never run it twice.

import { runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { db, rc } from '../firebase';
import { clean, escalationRef, getEscalation } from '../data/repo';
import { sha256 } from '../domain/pack';
import type { Escalation, EscalationReason } from '../domain/types';
import { cloudReview } from './tasks';
import { unsafeInstruction, unsupportedNumbers } from '../domain/guards';

export const REASON_LABEL: Record<EscalationReason, string> = {
  invalid_output: 'On-device output failed validation',
  missing_information: 'On-device answer lacked required information',
  beyond_pack: 'Question goes beyond the approved pack',
  exceeds_device_capability: 'Request exceeds on-device limits',
  user_request: 'Technician requested detailed cloud analysis',
  no_local_model: 'No local model on this device and offline',
};

export async function escalationId(roundId: string, stepId: string, reason: EscalationReason, payload: string) {
  return (await sha256(`${roundId}|${stepId}|${reason}|${payload}`)).slice(0, 24);
}

/** Create (idempotently) a consented escalation. Works offline: the write is queued locally. */
export async function queueEscalation(args: { roundId: string; stepId: string; reason: EscalationReason; payload: string }) {
  const id = await escalationId(args.roundId, args.stepId, args.reason, args.payload);
  const now = Date.now();
  const esc: Escalation = { id, ...args, status: 'queued', consentAt: now, createdAt: now, attempts: 0 };
  // Do not await: with the persistent cache, offline writes resolve only after sync.
  void setDoc(escalationRef(id), clean(esc), { merge: false }).catch(() => undefined);
  return id;
}

const LEASE_MS = 90_000;

/** Claim a queued escalation for processing. Requires connectivity (transactions are online-only). */
async function claim(id: string): Promise<Escalation | null> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(escalationRef(id));
    if (!snap.exists()) return null;
    const e = { ...(snap.data() as Escalation), id };
    const leased = e.status === 'running' && (e.leaseUntil ?? 0) > Date.now();
    if (e.status === 'done' || e.status === 'failed' || leased) return null;
    tx.update(escalationRef(id), { status: 'running', leaseUntil: Date.now() + LEASE_MS, attempts: e.attempts + 1 });
    return { ...e, attempts: e.attempts + 1 };
  });
}

let draining = false;

/** Process all pending escalations. Safe to call repeatedly (on reconnect, on interval). */
export async function drainQueue(pending: Escalation[]): Promise<{ processed: number; failed: number }> {
  if (draining || !navigator.onLine) return { processed: 0, failed: 0 };
  if (!rc.allowCloudEscalation()) return { processed: 0, failed: 0 };
  draining = true;
  let processed = 0;
  let failed = 0;
  try {
    for (const p of pending) {
      if (p.status !== 'queued' && !(p.status === 'running' && (p.leaseUntil ?? 0) < Date.now())) continue;
      let e: Escalation | null = null;
      try {
        e = await claim(p.id);
      } catch {
        continue; // offline again or contention; retry later
      }
      if (!e) continue;
      try {
        const res = await cloudReview(e.payload, { roundId: e.roundId, stepId: e.stepId, escalationReason: e.reason });
        const text = `${res.data.assessment} ${res.data.suggestedChecks.join(' ')}`;
        const flags: string[] = [];
        if (unsafeInstruction(text)) flags.push('unsafe-instruction-filtered');
        const extraNumbers = unsupportedNumbers(text, e.payload);
        if (extraNumbers.length) flags.push(`unverified-numbers:${extraNumbers.join(',')}`);
        await updateDoc(escalationRef(e.id), clean({
          status: 'done',
          result: { ...res.data, flags, ms: res.ms, model: res.model },
          resultSource: res.source,
          completedAt: Date.now(),
          leaseUntil: 0,
        }));
        processed++;
      } catch (err) {
        const msg = String(err);
        const quota = /429|quota|RESOURCE_EXHAUSTED/i.test(msg);
        const giveUp = !quota && e.attempts >= rc.maxEscalationAttempts();
        await updateDoc(escalationRef(e.id), { status: giveUp ? 'failed' : 'queued', error: msg.slice(0, 300), leaseUntil: 0 }).catch(() => undefined);
        failed++;
        if (quota || !navigator.onLine) break; // back off until next trigger
      }
    }
  } finally {
    draining = false;
  }
  return { processed, failed };
}

export { getEscalation };
