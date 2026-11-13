import { useMemo, useState } from 'react';
import demoManual from '../../../shared/fixtures/manual-aqualift-cp40.md?raw';
import { compileManual, analyzeTrends } from '../ai/tasks';
import { InferenceUnavailableError, StructuredOutputError } from '../ai/hybrid';
import {
  approvePack,
  getManual,
  recordIssue,
  resolveIssue,
  retirePack,
  saveEntry,
  saveManual,
  savePack,
  saveRound,
  setDraftReview,
  watchIssues,
  watchPacks,
} from '../data/repo';
import {
  approvalKeys,
  escalationKey,
  estimateTokens,
  generalSafetyKey,
  isExcludable,
  publishGate,
  safetyKey,
  sha256,
  STEP_CARD_TOKEN_BUDGET,
  stepTokenEstimates,
  thresholdKey,
  verifyPack,
} from '../domain/pack';
import { checkValue, describeThreshold, UNIT_LABEL } from '../domain/measure';
import type { Issue, ProcedurePack, Round } from '../domain/types';
import { useLive, useOnline } from '../hooks';
import { Card, Empty, LevelBadge, SourceBadge, Tag, time } from '../ui/bits';
import type { Session } from '../data/workspace';
import { unsupportedNumbers } from '../domain/guards';
import { issuesText } from '../ai/tasks';

type Screen = { k: 'list' } | { k: 'new' } | { k: 'review'; id: string };

export function Supervisor({ session }: { session: Session }) {
  const packs = useLive<ProcedurePack>(watchPacks);
  const [screen, setScreen] = useState<Screen>({ k: 'list' });
  if (screen.k === 'new') return <NewPack onDone={(id) => setScreen(id ? { k: 'review', id } : { k: 'list' })} packs={packs} />;
  if (screen.k === 'review') {
    const p = packs.find((x) => x.id === screen.id);
    if (!p) return <Empty>Loading pack…</Empty>;
    return <ReviewPack pack={p} session={session} superseded={packs.filter((x) => x.id !== p.id && x.equipmentId === p.equipmentId && x.status === 'approved')} onBack={() => setScreen({ k: 'list' })} />;
  }
  return (
    <div className="stack">
      <div className="row between">
        <h2>Procedure packs</h2>
        <button className="btn primary" onClick={() => setScreen({ k: 'new' })}>
          + Compile a manual
        </button>
      </div>
      {packs.length === 0 && <Empty>No packs yet. Compile the demo manual to start.</Empty>}
      {packs.map((p) => (
        <Card
          key={p.id}
          title={`${p.title} · v${p.version}`}
          right={<Tag tone={p.status}>{p.status === 'draft' ? 'Draft — not published' : p.status === 'approved' ? 'Approved' : 'Retired'}</Tag>}
        >
          <p className="muted">
            {p.equipment.name} {p.equipment.model} · manual rev {p.source.revision} · {p.steps.length} steps · compiled {time(p.provenance.compiledAt)} by{' '}
            <SourceBadge source={p.provenance.inferenceSource} ms={p.provenance.durationMs} model={p.provenance.model} />
          </p>
          <div className="row gap">
            <button className="btn" onClick={() => setScreen({ k: 'review', id: p.id })}>
              {p.status === 'draft' ? 'Review & approve' : 'View'}
            </button>
            {p.status === 'approved' && <AssignRound pack={p} session={session} />}
            {p.status === 'approved' && (
              <button className="btn" onClick={() => retirePack(p.id)} title="Retired packs stay for audit but cannot be assigned.">
                Retire
              </button>
            )}
          </div>
        </Card>
      ))}
      <Trends session={session} packs={packs} />
    </div>
  );
}

// ------------------------------------------------------------------ compile

function NewPack({ onDone, packs }: { onDone: (id?: string) => void; packs: ProcedurePack[] }) {
  const online = useOnline();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [equipmentId, setEquipmentId] = useState('pump-cp40-a');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(md|txt)$/i.test(f.name)) {
      setError('Upload the manual as .md or .txt (text is needed to verify every quote).');
      return;
    }
    setText(await f.text());
    setName(f.name);
  }

  async function compile() {
    setBusy(true);
    setError('');
    try {
      const res = await compileManual(text);
      const version = 1 + Math.max(0, ...packs.filter((p) => p.equipmentId === equipmentId).map((p) => p.version));
      const id = `${equipmentId}-v${version}-${Date.now().toString(36)}`;
      const pack: ProcedurePack = {
        ...res.data,
        id,
        equipmentId,
        version,
        status: 'draft',
        source: { name: name || 'manual', revision: res.data.sourceRevision, sha256: await sha256(text), chars: text.length },
        provenance: { model: res.model, inferenceSource: res.source, compiledAt: Date.now(), durationMs: res.ms },
        stepTokenEstimates: stepTokenEstimates(res.data),
        demoOnly: /DEMO ONLY/.test(text),
      };
      await Promise.all([saveManual(id, text), savePack(pack)]);
      onDone(id);
    } catch (e) {
      if (e instanceof StructuredOutputError) setError(`The cloud model returned an unusable pack (${e.message}). Nothing was saved. Try again.`);
      else if (e instanceof InferenceUnavailableError) setError(e.offline ? 'Compiling needs the cloud model. Connect and try again.' : e.message);
      else setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <button className="link" onClick={() => onDone()}>
        ← Packs
      </button>
      <h2>Compile a manual into a procedure pack</h2>
      <p className="muted">
        The cloud model reads the whole manual and proposes a small pack sized for on-device models. Nothing reaches technicians until you verify and approve every limit and safety item.
      </p>
      <div className="row gap wrap">
        <button
          className="btn"
          onClick={() => {
            setText(demoManual);
            setName('AQL-CP40-OM rev C (demo).md');
          }}
        >
          Use demo manual (fictional pump)
        </button>
        <label className="btn">
          Upload .md / .txt
          <input type="file" accept=".md,.txt,text/plain,text/markdown" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      <label className="field">
        Equipment ID
        <input value={equipmentId} onChange={(e) => setEquipmentId(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())} />
      </label>
      {text && (
        <Card title={name} right={<Tag>{text.length.toLocaleString()} chars · ≈{estimateTokens(text).toLocaleString()} tokens (on-device window 9,216)</Tag>}>
          <pre className="manual">{text}</pre>
        </Card>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn primary big" disabled={!text || busy || !online} onClick={compile}>
        {busy ? 'Compiling in the cloud…' : online ? 'Compile with cloud AI' : 'Offline — compiling needs the cloud'}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ review / approve

function ReviewPack({ pack, session, superseded, onBack }: { pack: ProcedurePack & { draftApprovals?: string[]; draftExcluded?: string[] }; session: Session; superseded: ProcedurePack[]; onBack: () => void }) {
  const [manual, setManual] = useState<string | null>(null);
  const [approved, setApproved] = useState<string[]>(pack.approval?.approvedItems ?? pack.draftApprovals ?? []);
  const [excluded, setExcluded] = useState<string[]>(pack.approval?.excludedItems ?? pack.draftExcluded ?? []);
  const [busy, setBusy] = useState(false);
  if (manual === null) {
    getManual(pack.id).then(setManual);
    return <Empty>Loading manual…</Empty>;
  }
  const locked = pack.status !== 'draft';
  const findings = verifyPack(pack, manual);
  const gate = publishGate(pack, manual, approved, excluded);
  const problems = (key: string) => findings.filter((f) => f.key === key);
  const toggle = (key: string) => {
    if (locked) return;
    const next = approved.includes(key) ? approved.filter((k) => k !== key) : [...approved, key];
    setApproved(next);
    void setDraftReview(pack.id, next, excluded);
  };
  const toggleExclude = (key: string) => {
    if (locked || !isExcludable(key)) return;
    const nextEx = excluded.includes(key) ? excluded.filter((k) => k !== key) : [...excluded, key];
    const nextAp = approved.filter((k) => k !== key);
    setExcluded(nextEx);
    setApproved(nextAp);
    void setDraftReview(pack.id, nextAp, nextEx);
  };
  const approveAllVerified = () => {
    // Items with any finding (including paraphrase warnings) must be approved one by one.
    const ok = [...new Set([...approved, ...approvalKeys(pack).filter((k) => problems(k).length === 0 && !excluded.includes(k))])];
    setApproved(ok);
    void setDraftReview(pack.id, ok, excluded);
  };

  const Item = ({ k, children }: { k: string; children: React.ReactNode }) => {
    const ps = problems(k);
    const isOut = excluded.includes(k);
    const blocked = !isOut && ps.some((p) => p.severity === 'blocker');
    return (
      <div className={`item ${blocked ? 'item-bad' : ''} ${isOut ? 'item-out' : ''}`}>
        <div className="row between">
          <label className="check">
            <input type="checkbox" disabled={locked || blocked || isOut} checked={approved.includes(k)} onChange={() => toggle(k)} />
            <span>{children}</span>
          </label>
          {!locked && isExcludable(k) && (
            <button className="btn small-btn" onClick={() => toggleExclude(k)}>
              {isOut ? 'Include' : 'Exclude'}
            </button>
          )}
        </div>
        {isOut ? (
          <span className="warn-note">Excluded by supervisor: technicians and the on-device model will not see this item.</span>
        ) : blocked ? (
          <ul className="problems">
            {ps.map((p, i) => (
              <li key={i}>✗ {p.message}</li>
            ))}
          </ul>
        ) : (
          <>
            <span className="verified">✓ quote found verbatim in manual</span>
            {ps.map((p, i) => (
              <span key={i} className="warn-note">
                ⚠ {p.message}
              </span>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="stack">
      <button className="link" onClick={onBack}>
        ← Packs
      </button>
      <div className="row between wrap">
        <h2>
          {pack.title} · v{pack.version}
        </h2>
        <Tag tone={pack.status}>{pack.status}</Tag>
      </div>
      {pack.demoOnly && <p className="demo-banner">DEMO ONLY — fictional equipment and values. Not real operating limits.</p>}
      <p className="muted">
        Compiled by <SourceBadge source={pack.provenance.inferenceSource} ms={pack.provenance.durationMs} model={pack.provenance.model} /> from {pack.source.name} (rev {pack.source.revision}, sha256 {pack.source.sha256.slice(0, 10)}…). Every limit, safety
        precaution and escalation rule below must quote the manual verbatim and be approved by you.
      </p>
      {!locked && (
        <div className="row gap wrap">
          <button className="btn" onClick={approveAllVerified}>
            Approve all items with no findings
          </button>
          <span className="muted">
            {gate.unapproved.length} item(s) awaiting approval · {excluded.length} excluded · {gate.blockers.length} blocker(s)
          </span>
        </div>
      )}

      {pack.generalSafety.length > 0 && (
        <Card title="General safety" tone="warn">
          {pack.generalSafety.map((s, i) => (
            <Item key={i} k={generalSafetyKey(i)}>
              {s.text}
              <q>{s.sourceQuote}</q>
            </Item>
          ))}
        </Card>
      )}

      {pack.steps.map((s) => {
        const unit = s.measurement?.unit ?? 'none';
        const tokens = pack.stepTokenEstimates[s.id];
        return (
          <Card
            key={s.id}
            title={`${s.id} · ${s.title}`}
            right={
              <Tag tone={tokens > STEP_CARD_TOKEN_BUDGET ? 'alarm' : undefined}>
                ~{tokens} / {STEP_CARD_TOKEN_BUDGET} tokens on-device
              </Tag>
            }
          >
            <p>
              <b>§{s.section}</b> {s.instruction}
            </p>
            {s.measurement && (
              <p className="muted">
                Measure: {s.measurement.label} ({UNIT_LABEL[unit]})
              </p>
            )}
            {problems(s.id).map((f, i) => (
              <p key={i} className={f.severity === 'blocker' ? 'error' : 'warn'}>
                {f.message}
              </p>
            ))}
            {s.thresholds.length > 0 && <h4>Limits (safety-relevant — verify each)</h4>}
            {s.thresholds.map((t, i) => (
              <Item key={i} k={thresholdKey(s.id, i)}>
                <b>{describeThreshold(t, unit)}</b>
                <q>{t.sourceQuote}</q>
              </Item>
            ))}
            {s.safety.length > 0 && <h4>Safety</h4>}
            {s.safety.map((x, i) => (
              <Item key={i} k={safetyKey(s.id, i)}>
                {x.text}
                <q>{x.sourceQuote}</q>
              </Item>
            ))}
            {s.escalation.length > 0 && <h4>Escalation rules</h4>}
            {s.escalation.map((x, i) => (
              <Item key={i} k={escalationKey(s.id, i)}>
                {x.condition}
                <q>{x.sourceQuote}</q>
              </Item>
            ))}
            {s.observationChecklist.length > 0 && <p className="muted">Note checklist (AI hint, not safety-critical): {s.observationChecklist.join(' · ')}</p>}
          </Card>
        );
      })}

      {!locked && (
        <button
          className="btn primary big"
          disabled={!gate.canPublish || busy}
          onClick={async () => {
            setBusy(true);
            await approvePack(pack.id, approved, excluded, session.displayName);
            // Only one approved version per equipment: older versions are retired (kept for audit).
            for (const old of superseded) void retirePack(old.id);
            setBusy(false);
          }}
        >
          {gate.canPublish ? 'Publish approved pack to technicians' : `Cannot publish: ${gate.blockers.length} blocker(s), ${gate.unapproved.length} unapproved`}
        </button>
      )}
      {pack.approval && (
        <p className="muted">
          Approved by {pack.approval.approvedBy} on {time(pack.approval.approvedAt)}. Approved packs are immutable; recompile to create a new version.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ assign

function AssignRound({ pack, session }: { pack: ProcedurePack; session: Session }) {
  const [shift, setShift] = useState(defaultShift());
  const [done, setDone] = useState(false);
  return (
    <div className="row gap">
      <input className="small" value={shift} onChange={(e) => setShift(e.target.value)} aria-label="Shift" />
      <button
        className="btn"
        onClick={async () => {
          const r: Round = {
            id: `r-${Date.now().toString(36)}`,
            packId: pack.id,
            packVersion: pack.version,
            equipmentId: pack.equipmentId,
            equipmentName: `${pack.equipment.name} ${pack.equipment.model}`,
            shift,
            assignee: session.user.uid,
            status: 'assigned',
            createdAt: Date.now(),
          };
          void saveRound(r);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
      >
        {done ? 'Assigned ✓' : 'Assign round'}
      </button>
    </div>
  );
}

function defaultShift() {
  const d = new Date();
  const h = d.getHours();
  const name = h < 7 ? 'Night' : h < 15 ? 'Day' : h < 23 ? 'Evening' : 'Night';
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${md} ${name}`;
}

// ------------------------------------------------------------------ trends

function Trends({ session, packs }: { session: Session; packs: ProcedurePack[] }) {
  const issues = useLive<Issue>(watchIssues);
  const online = useOnline();
  const [result, setResult] = useState<{ summary: string; recurring: { issueId: string; pattern: string; recommendation: string }[]; source: string; ms: number; flags: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const open = issues.filter((i) => i.status === 'open');
  const approved = packs.find((p) => p.status === 'approved');
  const facts = useMemo(() => issuesText(issues), [issues]);

  return (
    <>
      <div className="row between wrap">
        <h2>Issues across shifts</h2>
        <div className="row gap wrap">
          {approved && (
            <button className="btn" onClick={() => seedHistory(approved, session)} title="Creates two earlier completed rounds with synthetic readings, clearly labelled as demo data.">
              Seed demo history (synthetic)
            </button>
          )}
          <button
            className="btn"
            disabled={!online || busy || issues.length === 0}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                const r = await analyzeTrends(issues);
                const ids = new Set(issues.map((i) => i.id));
                const flags = [...unsupportedNumbers(`${r.data.summary} ${r.data.recurring.map((x) => x.pattern + x.recommendation).join(' ')}`, facts).map((n) => `unverified number ${n}`), ...r.data.recurring.filter((x) => !ids.has(x.issueId)).map((x) => `unknown issue ${x.issueId}`)];
                setResult({ ...r.data, source: r.source, ms: r.ms, flags });
              } catch (e) {
                setErr(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Analysing…' : online ? 'Find recurring problems (cloud)' : 'Offline'}
          </button>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {result && (
        <Card title="Recurring problems — AI suggestion" tone="ai" right={<SourceBadge source={result.source as never} ms={result.ms} />}>
          <p>{result.summary}</p>
          <ul>
            {result.recurring.map((r) => (
              <li key={r.issueId}>
                <b>{r.issueId}</b>: {r.pattern} → {r.recommendation}
              </li>
            ))}
          </ul>
          {result.flags.length > 0 && <p className="warn">Guard flags: {result.flags.join('; ')}</p>}
        </Card>
      )}
      {issues.length === 0 && <Empty>No issues recorded yet.</Empty>}
      {issues.map((i) => (
        <Card key={i.id} title={`${i.stepTitle} · ${i.equipmentId}`} right={<span className="row gap">{i.status === 'open' ? <LevelBadge level={i.worstLevel} /> : <Tag>resolved</Tag>}</span>}>
          <ol className="timeline">
            {i.occurrences
              .slice()
              .sort((a, b) => a.at - b.at)
              .map((o) => (
                <li key={o.roundId}>
                  <LevelBadge level={o.level} /> {o.shift}: {o.value ?? '–'} {o.unit ? UNIT_LABEL[o.unit] : ''} {o.note && <i>“{o.note}”</i>}
                </li>
              ))}
          </ol>
          {i.status === 'open' && (
            <button className="btn" onClick={() => resolveIssue(i.id, session.displayName)}>
              Mark resolved
            </button>
          )}
        </Card>
      ))}
      {open.length > 0 && <p className="muted">{open.length} open issue(s) will be carried into the next handover.</p>}
    </>
  );
}

/** Synthetic demo history: two earlier completed rounds. Values are fictional and labelled as such. */
async function seedHistory(pack: ProcedurePack, session: Session) {
  const shifts = [
    { shift: 'DEMO-1 Day', temp: 68, vib: 3.9, press: 3.9, note: 'Running normally' },
    { shift: 'DEMO-2 Evening', temp: 74, vib: 4.8, press: 3.8, note: 'Faint squeal near drive-end bearing' },
  ];
  const tempStep = pack.steps.find((s) => s.measurement?.unit === 'degC');
  const vibStep = pack.steps.find((s) => s.measurement?.unit === 'mm/s');
  const pressStep = pack.steps.find((s) => s.measurement?.unit === 'bar');
  let t = Date.now() - 2 * 8 * 3600_000;
  for (const sh of shifts) {
    const round: Round = {
      id: `demo-${sh.shift.replace(/\W/g, '')}-${pack.version}`,
      packId: pack.id,
      packVersion: pack.version,
      equipmentId: pack.equipmentId,
      equipmentName: `${pack.equipment.name} ${pack.equipment.model}`,
      shift: sh.shift,
      assignee: session.user.uid,
      status: 'completed',
      createdAt: t,
      startedAt: t,
      completedAt: t + 1200_000,
    };
    await saveRound(round);
    for (const [step, value] of [
      [pressStep, sh.press],
      [tempStep, sh.temp],
      [vibStep, sh.vib],
    ] as const) {
      if (!step?.measurement) continue;
      const check = checkValue(value, step.measurement.unit, step.thresholds);
      await saveEntry(round.id, { stepId: step.id, raw: String(value), value, unit: step.measurement.unit, check, observation: step === vibStep ? sh.note : undefined, recordedAt: t, recordedBy: session.user.uid });
      if (check.level !== 'ok') {
        await recordIssue({ equipmentId: pack.equipmentId, stepId: step.id, stepTitle: step.title }, { roundId: round.id, shift: sh.shift, at: t, level: check.level, value, unit: step.measurement.unit, note: step === vibStep ? sh.note : undefined });
      }
    }
    t += 8 * 3600_000;
  }
}
