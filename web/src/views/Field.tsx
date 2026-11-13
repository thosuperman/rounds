import { useEffect, useMemo, useState } from 'react';
import { askStep, interpretObservation, writeHandoverNarrative, factsText } from '../ai/tasks';
import { InferenceUnavailableError, StructuredOutputError } from '../ai/hybrid';
import { queueEscalation, REASON_LABEL } from '../ai/escalation';
import {
  getManual,
  getPack,
  listOpenIssues,
  recordIssue,
  saveEntry,
  saveHandover,
  updateRound,
  watchEntries,
  watchEscalations,
  watchIssues,
  watchRounds,
} from '../data/repo';
import { manualSection, publishedView, renderStepCard } from '../domain/pack';
import { checkValue, describeThreshold, MeasurementError, parseMeasurement, UNIT_LABEL } from '../domain/measure';
import { guardAnswer, guardInterpretation, unsafeInstruction } from '../domain/guards';
import { buildFacts, guardNarrative, issueHistory, priorDeviation, repairActions, templateNarrative } from '../domain/handover';
import type { AskAnswer, Entry, Escalation, EscalationReason, InferenceSourceLabel, Issue, ObservationInterpretation, PackStep, ProcedurePack, Round } from '../domain/types';
import { useLive, useOnline } from '../hooks';
import { Card, Empty, LevelBadge, SourceBadge, Tag, time } from '../ui/bits';
import type { Session } from '../data/workspace';

const PACK_CACHE = 'rounds.packcache.';
const MANUAL_CACHE = 'rounds.manualcache.';

/** The source manual is kept on the device only to attach the verbatim section to a consented cloud review. */
function cachedManual(id: string): string {
  try {
    return localStorage.getItem(MANUAL_CACHE + id) ?? '';
  } catch {
    return '';
  }
}

/** Approved packs are immutable, so a local copy is always valid for its version. */
function cachePack(p: ProcedurePack) {
  try {
    localStorage.setItem(PACK_CACHE + p.id, JSON.stringify(p));
  } catch {
    /* storage full / private mode: Firestore cache still applies */
  }
}
function cachedPack(id: string): ProcedurePack | null {
  try {
    const s = localStorage.getItem(PACK_CACHE + id);
    return s ? (JSON.parse(s) as ProcedurePack) : null;
  } catch {
    return null;
  }
}

export function Field({ session, onHandover }: { session: Session; onHandover?: () => void }) {
  const rounds = useLive<Round>(watchRounds);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rounds.find((r) => r.id === openId);
  if (open)
    return (
      <RoundRunner
        round={open}
        session={session}
        onBack={() => setOpenId(null)}
        onDone={() => {
          setOpenId(null);
          onHandover?.();
        }}
      />
    );
  const mine = rounds.filter((r) => r.assignee === session.user.uid);
  const active = mine.filter((r) => r.status !== 'completed');
  const done = mine.filter((r) => r.status === 'completed').slice(0, 5);
  return (
    <div className="stack">
      <h2>My inspection rounds</h2>
      {active.length === 0 && <Empty>No rounds assigned. A supervisor assigns rounds from an approved pack.</Empty>}
      {active.map((r) => (
        <button key={r.id} className="round-tile" onClick={() => setOpenId(r.id)}>
          <span className="round-title">{r.equipmentName}</span>
          <span className="muted">
            Shift {r.shift} · pack v{r.packVersion} · {r.status.replace('_', ' ')}
          </span>
          <span className="go">{r.status === 'assigned' ? 'Start →' : 'Continue →'}</span>
        </button>
      ))}
      {done.length > 0 && <h3>Completed</h3>}
      {done.map((r) => (
        <div key={r.id} className="muted small-row">
          {r.equipmentName} · {r.shift} · completed {time(r.completedAt)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- round runner

function RoundRunner({ round, session, onBack, onDone }: { round: Round; session: Session; onBack: () => void; onDone: () => void }) {
  const [pack, setPack] = useState<ProcedurePack | null>(() => cachedPack(round.packId));
  const [loadErr, setLoadErr] = useState('');
  const entries = useLive<Entry & { id: string }>((cb) => watchEntries(round.id, cb), [round.id]);
  const escalations = useLive<Escalation>(watchEscalations);
  const issues = useLive<Issue>(watchIssues);
  const [manual, setManual] = useState(() => cachedManual(round.packId));
  const [idx, setIdx] = useState(0);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    getManual(round.packId)
      .then((m) => {
        if (!m) return;
        setManual(m);
        try {
          localStorage.setItem(MANUAL_CACHE + round.packId, m);
        } catch {
          /* optional cache */
        }
      })
      .catch(() => undefined);
  }, [round.packId]);

  useEffect(() => {
    getPack(round.packId)
      .then((p) => {
        if (!p) return setLoadErr('Pack not found.');
        if (p.status !== 'approved') return setLoadErr('This pack is not approved. Rounds can only run approved packs.');
        const view = publishedView(p);
        cachePack(view);
        setPack(view);
      })
      .catch(() => {
        if (!cachedPack(round.packId)) setLoadErr('Pack not downloaded yet and you are offline.');
      });
  }, [round.packId]);

  if (loadErr && !pack) return <p className="error">{loadErr}</p>;
  if (!pack) return <Empty>Downloading procedure pack…</Empty>;

  const step = pack.steps[Math.min(idx, pack.steps.length - 1)];
  const entryFor = (id: string) => entries.find((e) => e.stepId === id);
  const doneCount = pack.steps.filter((s) => entryFor(s.id)).length;

  async function finish() {
    setFinishing(true);
    const completedAt = Date.now();
    void updateRound(round.id, { status: 'completed', completedAt });
    const issues = await listOpenIssues(round.equipmentId).catch(() => []);
    const facts = buildFacts({ ...round, completedAt }, pack!, entries, issues, escalations);
    const ftext = factsText(facts);
    let narrative = templateNarrative(facts);
    let source: InferenceSourceLabel = 'DETERMINISTIC';
    let rejected: string | undefined;
    try {
      const r = await writeHandoverNarrative(facts, { roundId: round.id });
      const reasons = guardNarrative(r.data, facts, ftext);
      if (reasons.length) rejected = `AI narrative rejected (${r.source}): ${reasons.join('; ')} — used the rule-based template.`;
      else {
        const fixed = repairActions(r.data, facts);
        narrative = fixed.narrative;
        source = r.source;
        if (fixed.replaced.length) rejected = `Actions corrected by rules: ${fixed.replaced.join('; ')}`;
      }
    } catch (e) {
      rejected = (e instanceof StructuredOutputError ? `AI narrative invalid (${e.source}): ${e.message}` : `No AI available: ${(e as Error).message}`) + ' — used the rule-based template.';
    }
    void saveHandover({ id: `h-${round.id}`, roundId: round.id, facts, narrative, narrativeSource: source, narrativeRejectedReason: rejected, createdAt: Date.now() });
    setFinishing(false);
    onDone();
  }

  return (
    <div className="stack runner">
      <div className="row between">
        <button className="link" onClick={onBack}>
          ← Rounds
        </button>
        <Tag tone="ok">Pack v{pack.version} cached for offline ✓</Tag>
      </div>
      <h2>{round.equipmentName}</h2>
      {pack.demoOnly && <p className="demo-banner">DEMO ONLY — fictional equipment and limits.</p>}
      <nav className="steps">
        {pack.steps.map((s, i) => {
          const e = entryFor(s.id);
          return (
            <button key={s.id} className={`step-pill ${i === idx ? 'on' : ''} ${e?.check ? `pill-${e.check.level}` : e ? 'pill-ok' : ''}`} onClick={() => setIdx(i)}>
              {i + 1}. {s.title}
            </button>
          );
        })}
      </nav>
      <StepPanel key={step.id} pack={pack} step={step} round={round} session={session} entry={entryFor(step.id)} manual={manual} issue={issues.find((i) => i.id === `${round.equipmentId}__${step.id}` && i.status === 'open')} escalations={escalations.filter((e) => e.roundId === round.id && e.stepId === step.id)} />
      <div className="row between">
        <button className="btn big" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← Previous
        </button>
        {idx < pack.steps.length - 1 ? (
          <button className="btn primary big" onClick={() => setIdx(idx + 1)}>
            Next step →
          </button>
        ) : (
          <button className="btn primary big" disabled={finishing || doneCount < pack.steps.length} onClick={finish}>
            {finishing ? 'Preparing handover…' : doneCount < pack.steps.length ? `${pack.steps.length - doneCount} step(s) left` : 'Complete round & prepare handover'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- one step

interface Consent {
  reason: EscalationReason;
  payload: string;
}

function StepPanel({ pack, step, round, session, entry, manual, issue, escalations }: { pack: ProcedurePack; step: PackStep; round: Round; session: Session; entry?: Entry; manual: string; issue?: Issue; escalations: Escalation[] }) {
  const card = useMemo(() => renderStepCard(pack, step), [pack, step]);
  const unit = step.measurement?.unit ?? 'none';
  const [raw, setRaw] = useState(entry?.raw ?? '');
  const [inputErr, setInputErr] = useState('');
  const [note, setNote] = useState(entry?.observation ?? '');
  const [interp, setInterp] = useState<{ data?: ObservationInterpretation; source: InferenceSourceLabel; ms?: number; problem?: string; dropped?: string[] } | null>(
    entry?.interpretation ? { data: entry.interpretation, source: entry.interpretationSource ?? 'NONE' } : null,
  );
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ data?: AskAnswer; source: InferenceSourceLabel; ms?: number; problem?: string } | null>(null);
  const [busy, setBusy] = useState<'' | 'interpret' | 'ask'>('');
  const elapsed = useElapsed(busy !== '');
  const [consent, setConsent] = useState<Consent | null>(null);
  const [suggest, setSuggest] = useState<EscalationReason | null>(null);
  const online = useOnline();

  const check = entry?.check;
  const prior = priorDeviation(issue, round.id);
  const shiftRules = step.escalation.filter((e) => /shift|consecutive|repeat/i.test(`${e.condition} ${e.sourceQuote}`));

  function record(nextNote = note, interpretation = interp) {
    let value: number | undefined;
    let checkRes = undefined;
    if (step.measurement) {
      try {
        const p = parseMeasurement(raw, unit);
        value = p.value;
        checkRes = checkValue(p.value, unit, step.thresholds);
        setInputErr('');
      } catch (e) {
        setInputErr(e instanceof MeasurementError ? e.message : String(e));
        return;
      }
    }
    const e: Entry = {
      stepId: step.id,
      raw,
      value,
      unit: step.measurement ? unit : undefined,
      check: checkRes,
      observation: nextNote || undefined,
      interpretation: interpretation?.data,
      interpretationSource: interpretation?.data ? interpretation.source : undefined,
      recordedAt: Date.now(),
      recordedBy: session.user.uid,
    };
    void saveEntry(round.id, e);
    if (round.status === 'assigned') void updateRound(round.id, { status: 'in_progress', startedAt: Date.now() });
    const concern = (interpretation?.data?.concerns.length ?? 0) > 0;
    const level = checkRes?.level ?? 'ok';
    if (level !== 'ok' || concern) {
      void recordIssue(
        { equipmentId: round.equipmentId, stepId: step.id, stepTitle: step.title },
        { roundId: round.id, shift: round.shift, at: Date.now(), level: level === 'ok' ? 'attention' : level, value, unit: step.measurement ? unit : undefined, note: nextNote || undefined },
      );
    }
  }

  const canSave = () => !step.measurement || !!raw.trim();

  async function runInterpret() {
    if (!note.trim()) return;
    setBusy('interpret');
    setSuggest(null);
    try {
      const reading = raw ? `${raw} ${UNIT_LABEL[unit]}` : undefined;
      const r = await interpretObservation(card, note, reading, { roundId: round.id, stepId: step.id });
      const g = guardInterpretation(r.data, step.observationChecklist, `${note} ${raw}`, card, { measurementLabel: step.measurement?.label, hasReading: !!entry?.value || !!raw });
      if (!g.ok) {
        setInterp({ source: r.source, ms: r.ms, problem: `Output rejected by validation: ${g.reasons.join('; ')}` });
        setSuggest('invalid_output');
      } else {
        const next = { data: g.value!, source: r.source, ms: r.ms };
        setInterp({ ...next, dropped: g.dropped });
        if (g.value!.beyondPack || g.value!.confidence === 'low') setSuggest('beyond_pack');
        // A measurement step is saved with its reading; the interpretation is attached then.
        if (canSave()) record(note, next);
      }
    } catch (e) {
      if (e instanceof StructuredOutputError) {
        setInterp({ source: e.source, problem: `Invalid structured output from ${e.source === 'ON_DEVICE' ? 'on-device model' : 'cloud'}: ${e.message}` });
        setSuggest('invalid_output');
      } else if (e instanceof InferenceUnavailableError) {
        setInterp({
          source: 'NONE',
          problem: e.needsConsent || e.offline ? `${e.message} You can send this note for cloud review after checking what is shared.` : e.message,
        });
        setSuggest(e.needsConsent || e.offline ? 'no_local_model' : 'exceeds_device_capability');
        if (canSave()) record(note, null);
      } else setInterp({ source: 'NONE', problem: String(e) });
    } finally {
      setBusy('');
    }
  }

  async function runAsk() {
    if (!question.trim()) return;
    setBusy('ask');
    setSuggest(null);
    try {
      const r = await askStep(card, question, { roundId: round.id, stepId: step.id });
      const g = guardAnswer(r.data, card, question);
      if (!g.ok || unsafeInstruction(r.data.answer)) {
        setAnswer({ source: r.source, ms: r.ms, problem: `Answer withheld: ${g.reasons.join('; ') || 'unsafe wording'}` });
        setSuggest('invalid_output');
      } else if (!r.data.answerable) {
        setAnswer({ data: r.data, source: r.source, ms: r.ms });
        setSuggest('beyond_pack');
      } else if (r.data.packFactsUsed.length === 0) {
        setAnswer({ data: r.data, source: r.source, ms: r.ms, problem: 'The answer did not cite the approved pack.' });
        setSuggest('missing_information');
      } else setAnswer({ data: r.data, source: r.source, ms: r.ms });
    } catch (e) {
      if (e instanceof StructuredOutputError) {
        setAnswer({ source: e.source, problem: `Invalid structured output: ${e.message}` });
        setSuggest('invalid_output');
      } else if (e instanceof InferenceUnavailableError) {
        setAnswer({ source: 'NONE', problem: e.message });
        setSuggest(e.needsConsent || e.offline ? 'no_local_model' : 'exceeds_device_capability');
      }
    } finally {
      setBusy('');
    }
  }

  function escalationPayload(reason: EscalationReason) {
    const lines = [
      `REASON: ${REASON_LABEL[reason]}`,
      `PROCEDURE STEP (approved pack v${pack.version}):`,
      card,
      `READING: ${entry?.value ?? (raw || 'none')} ${step.measurement ? UNIT_LABEL[unit] : ''} → rule result: ${check?.level ?? 'not recorded'}`,
      note ? `TECHNICIAN NOTE: ${note}` : '',
      question ? `TECHNICIAN QUESTION: ${question}` : '',
      // Cloud-only context: too much for every on-device call, useful for a deeper review.
      `HISTORY OF THIS CHECK ACROSS SHIFTS:\n${issueHistory(issue)}`,
      manual ? `MANUAL SECTION §${step.section} (verbatim):\n${manualSection(manual, step.section)}` : '',
    ];
    return lines.filter(Boolean).join('\n');
  }

  const pendingEsc = escalations.filter((e) => e.status === 'queued' || e.status === 'running');
  const doneEsc = escalations.filter((e) => e.status === 'done' || e.status === 'failed');

  return (
    <div className="stack">
      <Card title={`§${step.section} · ${step.title}`}>
        <p className="instruction">{step.instruction}</p>
        {step.safety.map((s, i) => (
          <p key={i} className="safety">
            ⚠ {s.text}
          </p>
        ))}
        {pack.generalSafety.length > 0 && idxIsFirst(pack, step) && (
          <div className="safety">
            {pack.generalSafety.map((s, i) => (
              <p key={i}>⚠ {s.text}</p>
            ))}
          </div>
        )}
      </Card>

      {step.measurement && (
        <Card title={`${step.measurement.label} (${UNIT_LABEL[unit]})`} tone={check ? (check.level === 'ok' ? 'rule' : check.level === 'alarm' ? 'alarm' : 'warn') : undefined}>
          <div className="reading">
            <input
              className="reading-input"
              inputMode="decimal"
              value={raw}
              placeholder="0.0"
              onChange={(e) => setRaw(e.target.value)}
              aria-label={`${step.measurement.label} reading`}
            />
            <span className="unit">{UNIT_LABEL[unit]}</span>
          </div>
          <Keypad value={raw} onChange={setRaw} />
          {inputErr && <p className="error">{inputErr}</p>}
          <button className="btn primary big" disabled={!raw} onClick={() => record()}>
            Record reading
          </button>
          {check && (
            <div className="rule-result">
              <LevelBadge level={check.level} big />
              <span className="rule-label">
                Verified rule · <SourceBadge source="DETERMINISTIC" />
              </span>
              <p>
                {check.value} {UNIT_LABEL[unit]}:{' '}
                {check.fired.length ? check.fired.map((t) => describeThreshold(t, unit)).join(', ') : 'within all approved limits'}
                {check.fired[0] && <q> {check.fired[0].sourceQuote}</q>}
              </p>
              {check.level === 'alarm' && (
                <div className="alarm-text">
                  <p>Alarm. Follow the approved escalation rules for this check (AI cannot override them):</p>
                  {step.escalation.length ? (
                    <ul>
                      {step.escalation.map((e, i) => (
                        <li key={i}>
                          {e.condition} <q>{e.sourceQuote}</q>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No escalation rule was approved for this check. Stop and contact your supervisor.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {check && check.level !== 'ok' && prior && (
            <div className="repeat-text">
              <p>
                <b>Repeat deviation.</b> This check was also outside its normal limits on shift {prior.shift} ({prior.value ?? '–'} {UNIT_LABEL[unit]}, {prior.level}). Rule-based, from recorded readings.
              </p>
              {shiftRules.length > 0 ? (
                <ul>
                  {shiftRules.map((e, i) => (
                    <li key={i}>
                      {e.condition} <q>{e.sourceQuote}</q>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No approved escalation rule covers repeated deviations. Mention it in the handover.</p>
              )}
            </div>
          )}
          <details className="limits">
            <summary>Approved limits for this check</summary>
            <ul>
              {step.thresholds.map((t, i) => (
                <li key={i}>{describeThreshold(t, unit)}</li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      <Card title="Observation" right={<span className="muted">AI assists; it never decides</span>}>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. squeal louder than yesterday near the drive end" />
        <div className="row gap wrap">
          <button className="btn big" disabled={!note.trim() || busy !== ''} onClick={runInterpret}>
            {busy === 'interpret' ? `Checking note… ${elapsed}s` : 'Check my note (local AI)'}
          </button>
          {!step.measurement && (
            <button className="btn big" onClick={() => record()}>
              Save step
            </button>
          )}
        </div>
        {interp && (
          <div className="ai-out">
            <div className="row between">
              <span className="ai-label">AI suggestion</span>
              <SourceBadge source={interp.source} ms={interp.ms} />
            </div>
            {interp.problem && <p className="warn">{interp.problem}</p>}
            {interp.data && (
              <>
                <p>{interp.data.summary}</p>
                {interp.data.concerns.length > 0 && <p>Differs from expected: {interp.data.concerns.join(', ')}</p>}
                {interp.data.missingInfo.length > 0 && (
                  <p className="missing">
                    Missing: {interp.data.missingInfo.join(', ')}
                    {interp.data.followUpQuestion && <b> — {interp.data.followUpQuestion}</b>}
                  </p>
                )}
                <p className="muted small">
                  Category {interp.data.category} · confidence {interp.data.confidence}
                </p>
                {interp.dropped?.length ? (
                  <p className="muted small">Removed by rule check (numbers are judged only by approved limits): {interp.dropped.join('; ')}</p>
                ) : null}
              </>
            )}
          </div>
        )}
      </Card>

      <Card title="Ask about this step">
        <div className="row gap">
          <input className="grow" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Where is marker V1?" />
          <button className="btn" disabled={!question.trim() || busy !== ''} onClick={runAsk}>
            {busy === 'ask' ? `… ${elapsed}s` : 'Ask'}
          </button>
        </div>
        {answer && (
          <div className="ai-out">
            <div className="row between">
              <span className="ai-label">AI answer from approved pack</span>
              <SourceBadge source={answer.source} ms={answer.ms} />
            </div>
            {answer.problem && <p className="warn">{answer.problem}</p>}
            {answer.data && <p>{answer.data.answer}</p>}
            {answer.data?.packFactsUsed.length ? <p className="muted small">Based on: {answer.data.packFactsUsed.join(' · ')}</p> : null}
          </div>
        )}
      </Card>

      <Card title="Cloud review" right={online ? <Tag>online</Tag> : <Tag tone="alarm">offline — will queue</Tag>}>
        {suggest && (
          <p className="suggest">
            Suggested: {REASON_LABEL[suggest]}.{' '}
            <button className="link" onClick={() => setConsent({ reason: suggest, payload: escalationPayload(suggest) })}>
              Review what would be sent →
            </button>
          </p>
        )}
        <button className="btn" onClick={() => setConsent({ reason: 'user_request', payload: escalationPayload('user_request') })}>
          Request detailed cloud analysis
        </button>
        {pendingEsc.map((e) => (
          <p key={e.id} className="queued">
            ⏳ {REASON_LABEL[e.reason]} — {e.status === 'running' ? 'running in cloud…' : online ? 'sending…' : 'queued until connection returns'}
            {(e as Escalation & { _pending?: boolean })._pending ? ' (saved on this device)' : ''}
          </p>
        ))}
        {doneEsc.map((e) => (
          <EscalationResult key={e.id} e={e} />
        ))}
      </Card>

      {consent && (
        <ConsentDialog
          consent={consent}
          onCancel={() => setConsent(null)}
          onConfirm={async (payload) => {
            await queueEscalation({ roundId: round.id, stepId: step.id, reason: consent.reason, payload });
            setConsent(null);
            setSuggest(null);
          }}
        />
      )}
    </div>
  );
}

function idxIsFirst(pack: ProcedurePack, step: PackStep) {
  return pack.steps[0]?.id === step.id;
}

function EscalationResult({ e }: { e: Escalation }) {
  const r = e.result as
    | { assessment: string; possibleCauses: { cause: string; basis: string }[]; suggestedChecks: string[]; urgency: string; packSectionsCited: string[]; flags: string[]; ms: number; model: string }
    | undefined;
  if (e.status === 'failed') return <p className="error">Cloud review failed after {e.attempts} attempts: {e.error}</p>;
  if (!r) return null;
  const unsafe = r.flags?.includes('unsafe-instruction-filtered');
  return (
    <div className="ai-out cloud">
      <div className="row between">
        <span className="ai-label">Cloud review · {REASON_LABEL[e.reason]}</span>
        <SourceBadge source={e.resultSource ?? 'IN_CLOUD'} ms={r.ms} model={r.model} />
      </div>
      {unsafe ? (
        <p className="error">The cloud answer contained wording that could bypass a safety control and was hidden. Follow the approved procedure.</p>
      ) : (
        <>
          <p>
            <Tag tone={r.urgency === 'immediate' ? 'alarm' : r.urgency === 'soon' ? 'attention' : undefined}>urgency: {r.urgency}</Tag> {r.assessment}
          </p>
          {r.possibleCauses.length > 0 && (
            <ul>
              {r.possibleCauses.map((c, i) => (
                <li key={i}>
                  {c.cause} <span className="muted">({c.basis})</span>
                </li>
              ))}
            </ul>
          )}
          {r.suggestedChecks.length > 0 && <p>Suggested checks: {r.suggestedChecks.join('; ')}</p>}
        </>
      )}
      {r.flags?.filter((f) => f !== 'unsafe-instruction-filtered').map((f) => (
        <p key={f} className="warn small">
          Guard: {f}
        </p>
      ))}
      <p className="muted small">Advisory only. Approved limits and procedures are unchanged.</p>
    </div>
  );
}

function ConsentDialog({ consent, onCancel, onConfirm }: { consent: Consent; onCancel: () => void; onConfirm: (payload: string) => void }) {
  const [payload, setPayload] = useState(consent.payload);
  const online = navigator.onLine;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Send to cloud review">
      <div className="modal-box">
        <h3>Send to cloud review?</h3>
        <p className="muted">
          {REASON_LABEL[consent.reason]}. This exact text will be sent to the cloud model through Firebase AI Logic{online ? '' : ' when the connection returns'}. Remove anything you do not want to share. No names
          or photos are included.
        </p>
        <textarea rows={10} value={payload} onChange={(e) => setPayload(e.target.value)} />
        <div className="row between">
          <button className="btn big" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary big" onClick={() => onConfirm(payload)}>
            {online ? 'Send' : 'Queue for later'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- glove-friendly keypad

function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];
  return (
    <div className="keypad">
      {keys.map((k) => (
        <button
          key={k}
          className="key"
          onClick={() => {
            if (k === '⌫') onChange(value.slice(0, -1));
            else if (k === '.' && value.includes('.')) return;
            else onChange(value + k);
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/** Seconds since `running` became true; shown on slow on-device calls so the wait is visible. */
function useElapsed(running: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    setSec(0);
    const t = setInterval(() => setSec(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);
  return sec;
}
