// Firestore security rules tests. Run with: npm test (starts the Firestore emulator).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const W = 'alice';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rounds-rules-test',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'workspaces', W), { owner: W, roles: { alice: ['supervisor', 'technician'], tom: ['technician'] } });
    await setDoc(doc(db, 'workspaces', W, 'packs', 'approved1'), { status: 'approved', title: 'P', approval: { approvedItems: ['s1.t0'], approvedAt: 1 } });
    await setDoc(doc(db, 'workspaces', W, 'packs', 'draft1'), { status: 'draft', title: 'D' });
    await setDoc(doc(db, 'workspaces', W, 'rounds', 'r1'), { assignee: 'tom', status: 'assigned', packId: 'approved1' });
    await setDoc(doc(db, 'workspaces', W, 'escalations', 'e-done'), { status: 'done', payload: 'x', consentAt: 1 });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const p = (...s: string[]) => ['workspaces', W, ...s] as [string, ...string[]];

describe('workspaces', () => {
  it('a user can create only their own workspace with only themselves as member', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'workspaces', 'bob'), { owner: 'bob', roles: { bob: ['supervisor', 'technician'] } }));
    await assertFails(setDoc(doc(as('bob'), 'workspaces', 'carol'), { owner: 'bob', roles: { bob: ['supervisor'] } }));
    await assertFails(setDoc(doc(as('bob'), 'workspaces', 'bob2'), { owner: 'bob', roles: { bob: ['supervisor'], eve: ['supervisor'] } }));
  });
  it('a new user can check whether their own (missing) workspace exists, but not anyone else\'s', async () => {
    await assertSucceeds(getDoc(doc(as('newbie'), 'workspaces', 'newbie')));
    await assertFails(getDoc(doc(as('newbie'), 'workspaces', 'someone')));
  });
  it('outsiders cannot read a workspace or its packs', async () => {
    await assertFails(getDoc(doc(as('mallory'), ...p())));
    await assertFails(getDoc(doc(as('mallory'), ...p('packs', 'approved1'))));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), ...p('packs', 'approved1'))));
  });
});

describe('procedure packs', () => {
  it('supervisor can create drafts but not pre-approved packs', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), ...p('packs', 'n1')), { status: 'draft', title: 'x' }));
    await assertFails(setDoc(doc(as('alice'), ...p('packs', 'n2')), { status: 'approved', title: 'x' }));
    await assertFails(setDoc(doc(as('alice'), ...p('packs', 'n3')), { status: 'draft', title: 'x', approval: { approvedItems: ['a'] } }));
  });
  it('technicians cannot create or approve packs', async () => {
    await assertFails(setDoc(doc(as('tom'), ...p('packs', 'n4')), { status: 'draft', title: 'x' }));
    await assertFails(updateDoc(doc(as('tom'), ...p('packs', 'draft1')), { status: 'approved', approval: { approvedItems: ['a'], approvedAt: 1 } }));
  });
  it('supervisor can approve a draft, but not with zero approved items', async () => {
    await assertFails(updateDoc(doc(as('alice'), ...p('packs', 'draft1')), { status: 'approved', approval: { approvedItems: [], approvedAt: 1 } }));
    await assertSucceeds(updateDoc(doc(as('alice'), ...p('packs', 'draft1')), { status: 'approved', approval: { approvedItems: ['s1.t0'], approvedAt: 1 } }));
  });
  it('supervisor can save review progress (approvals and exclusions) on a draft only', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), ...p('packs', 'draft1')), { draftApprovals: ['s1.t0'], draftExcluded: ['s2.safety0'] }));
    await assertFails(updateDoc(doc(as('alice'), ...p('packs', 'draft1')), { draftExcluded: ['x'], title: 'edited' }));
    await assertFails(updateDoc(doc(as('alice'), ...p('packs', 'approved1')), { draftExcluded: ['s2.safety0'] }));
  });
  it('drafts cannot be edited while approving (content change rejected)', async () => {
    await assertFails(updateDoc(doc(as('alice'), ...p('packs', 'draft1')), { status: 'approved', title: 'changed', approval: { approvedItems: ['a'], approvedAt: 1 } }));
  });
  it('approved packs are immutable; they can only be retired', async () => {
    await assertFails(updateDoc(doc(as('alice'), ...p('packs', 'approved1')), { title: 'tampered' }));
    await assertFails(updateDoc(doc(as('alice'), ...p('packs', 'approved1')), { status: 'draft' }));
    await assertSucceeds(updateDoc(doc(as('alice'), ...p('packs', 'approved1')), { status: 'retired' }));
    await assertFails(deleteDoc(doc(as('alice'), ...p('packs', 'approved1'))));
  });
});

describe('rounds and readings', () => {
  it('only the assignee can record readings, as themselves', async () => {
    const entry = { stepId: 's1', raw: '4.1', value: 4.1, recordedBy: 'tom', recordedAt: 1 };
    await assertSucceeds(setDoc(doc(as('tom'), ...p('rounds', 'r1', 'entries', 's1')), entry));
    await assertFails(setDoc(doc(as('alice'), ...p('rounds', 'r1', 'entries', 's1')), { ...entry, recordedBy: 'alice' }));
    await assertFails(setDoc(doc(as('tom'), ...p('rounds', 'r1', 'entries', 's1')), { ...entry, recordedBy: 'alice' }));
    await assertFails(setDoc(doc(as('tom'), ...p('rounds', 'r1', 'entries', 's2')), entry));
  });
  it('assignee can only change round status fields', async () => {
    await assertSucceeds(updateDoc(doc(as('tom'), ...p('rounds', 'r1')), { status: 'completed', completedAt: 2 }));
    await assertFails(updateDoc(doc(as('tom'), ...p('rounds', 'r1')), { packId: 'other' }));
  });
});

describe('escalations', () => {
  it('requires consent and a queued status on create', async () => {
    await assertSucceeds(setDoc(doc(as('tom'), ...p('escalations', 'e1')), { status: 'queued', payload: 'p', consentAt: 1 }));
    await assertFails(setDoc(doc(as('tom'), ...p('escalations', 'e2')), { status: 'queued', payload: 'p' }));
    await assertFails(setDoc(doc(as('tom'), ...p('escalations', 'e3')), { status: 'done', payload: 'p', consentAt: 1 }));
  });
  it('a done escalation can never be re-queued (idempotent re-submit)', async () => {
    await assertFails(setDoc(doc(as('tom'), ...p('escalations', 'e-done')), { status: 'queued', payload: 'x', consentAt: 2 }));
    await assertFails(updateDoc(doc(as('tom'), ...p('escalations', 'e-done')), { status: 'running' }));
  });
  it('payload cannot be altered after consent', async () => {
    await assertSucceeds(setDoc(doc(as('tom'), ...p('escalations', 'e4')), { status: 'queued', payload: 'p', consentAt: 1 }));
    await assertFails(updateDoc(doc(as('tom'), ...p('escalations', 'e4')), { payload: 'something else' }));
    await assertSucceeds(updateDoc(doc(as('tom'), ...p('escalations', 'e4')), { status: 'running', leaseUntil: 5 }));
  });
});

describe('ledger and handovers', () => {
  it('ledger is append-only', async () => {
    const ref = await assertSucceeds(addDoc(collection(as('tom'), ...p('ledger')), { task: 'interpret', source: 'ON_DEVICE' }));
    await assertFails(updateDoc(ref, { source: 'IN_CLOUD' }));
    await assertFails(deleteDoc(ref));
  });
  it('handover facts cannot be edited, only acknowledged', async () => {
    await assertSucceeds(setDoc(doc(as('tom'), ...p('handovers', 'h1')), { facts: { a: 1 } }));
    await assertFails(updateDoc(doc(as('alice'), ...p('handovers', 'h1')), { facts: { a: 2 } }));
    await assertSucceeds(updateDoc(doc(as('alice'), ...p('handovers', 'h1')), { acknowledgedBy: 'alice', acknowledgedAt: 3 }));
  });
});
