// Shift handover: facts are assembled deterministically from recorded entries and issues.
// The model only writes prose around them, and that prose is rejected if it adds numbers or ids.

import type { Entry, Escalation, Handover, HandoverFacts, Issue, ProcedurePack, Round } from './types';
import { unsupportedNumbers } from './guards';
import { UNIT_LABEL } from './measure';

export function buildFacts(round: Round, pack: ProcedurePack, entries: Entry[], issues: Issue[], escalations: Escalation[]): HandoverFacts {
  const byStep = new Map(entries.map((e) => [e.stepId, e]));
  return {
    roundId: round.id,
    equipmentName: `${pack.equipment.name} (${pack.equipment.model})`,
    shift: round.shift,
    completedAt: round.completedAt ?? Date.now(),
    measurements: pack.steps.map((s) => {
      const e = byStep.get(s.id);
      return { stepId: s.id, title: s.title, value: e?.value, unit: e?.unit, level: e?.check?.level ?? 'ok' };
    }),
    openIssues: issues
      .filter((i) => i.status === 'open' && i.equipmentId === round.equipmentId)
      .map((i) => {
        const last = i.occurrences.slice().sort((a, b) => b.at - a.at)[0];
        return { issueId: i.id, title: i.stepTitle, level: last?.level ?? i.worstLevel, occurrences: new Set(i.occurrences.map((o) => o.shift)).size, lastNote: last?.note };
      }),
    pendingEscalations: escalations
      .filter((e) => e.roundId === round.id && (e.status === 'queued' || e.status === 'running'))
      .map((e) => ({ id: e.id, stepId: e.stepId, reason: e.reason })),
  };
}

/** Deterministic fallback text, used when no model is available or the model output is rejected. */
export function templateNarrative(f: HandoverFacts): NonNullable<Handover['narrative']> {
  const alarms = f.measurements.filter((m) => m.level === 'alarm');
  const attention = f.measurements.filter((m) => m.level === 'attention');
  const headline = alarms.length
    ? `${alarms.length} alarm reading(s) on ${f.equipmentName}`
    : attention.length
      ? `${attention.length} reading(s) need attention`
      : 'All readings within approved limits';
  const fmt = (m: HandoverFacts['measurements'][number]) => `${m.title} ${m.value ?? '–'} ${m.unit ? UNIT_LABEL[m.unit] : ''}`.trim();
  const narrative = [
    alarms.length ? `Alarm: ${alarms.map(fmt).join(', ')}.` : '',
    attention.length ? `Attention: ${attention.map(fmt).join(', ')}.` : '',
    f.openIssues.length ? `${f.openIssues.length} open issue(s) carried over.` : 'No open issues.',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    headline,
    narrative,
    actions: f.openIssues.map((i) => ({ issueId: i.issueId, action: `Re-check ${i.title} at the start of the shift.` })),
  };
}

export function guardNarrative(n: NonNullable<Handover['narrative']>, facts: HandoverFacts, factsText: string): string[] {
  const reasons: string[] = [];
  const text = `${n.headline} ${n.narrative} ${n.actions.map((a) => a.action).join(' ')}`;
  const bad = unsupportedNumbers(text, factsText);
  if (bad.length) reasons.push(`introduced numbers not in the facts: ${bad.join(', ')}`);
  // Issue coverage (unknown or missing actions) is repaired deterministically in repairActions.
  // Prose must not soften what the rules found.
  const prose = `${n.headline} ${n.narrative}`.toLowerCase();
  const alarms = facts.measurements.filter((m) => m.level === 'alarm').length + facts.openIssues.filter((i) => i.level === 'alarm').length;
  const deviations = alarms + facts.measurements.filter((m) => m.level === 'attention').length;
  if (deviations && /\b(stabl[ey]|normal(ly)?|fine|no (issues|problems|concerns)|all (readings )?(ok|within))\b/.test(prose)) {
    reasons.push('reassuring wording while readings are outside limits');
  }
  // A round can only be completed with every step recorded, so "not done" claims are always false.
  if (/\b(not (been )?(performed|done|checked|completed|recorded|carried out|inspected)|skipped|missed|omitted|incomplete)\b/.test(prose)) {
    reasons.push('claims a check was not done, but every step was recorded');
  }
  return reasons;
}

const STOP = new Set(['and', 'the', 'of', 'for', 'at', 'on', 'in', 'to', 'check', 'reading']);
const words = (t: string) => t.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Each AI action must be about its issue: it has to mention a word from the issue title.
 * Off-topic actions are replaced with the deterministic template action and reported.
 */
export function repairActions(n: NonNullable<Handover['narrative']>, facts: HandoverFacts) {
  const byId = new Map(facts.openIssues.map((i) => [i.issueId, i]));
  const replaced: string[] = [];
  const template = (issueId: string, title: string) => ({ issueId, action: `Re-check ${title} at the start of the shift.` });
  const unknown = n.actions.filter((a) => !byId.has(a.issueId));
  if (unknown.length) replaced.push(`dropped action(s) for unknown issue ids: ${unknown.map((a) => a.issueId).join(', ')}`);
  const known = n.actions.filter((a) => byId.has(a.issueId));
  const actions = known.map((a) => {
    const issue = byId.get(a.issueId)!;
    const topic = [...words(issue.title), ...words(issue.lastNote ?? '')];
    if (topic.some((w) => a.action.toLowerCase().includes(w))) return a;
    replaced.push(`"${a.action}" is not about ${issue.title}`);
    return template(a.issueId, issue.title);
  });
  for (const i of facts.openIssues) {
    if (!actions.some((a) => a.issueId === i.issueId)) {
      actions.push(template(i.issueId, i.title));
      replaced.push(`added missing action for ${i.title}`);
    }
  }
  return { narrative: { ...n, actions }, replaced };
}

/** Most recent deviation on this check recorded in a different round, if any. */
export function priorDeviation(issue: Issue | undefined, roundId: string) {
  if (!issue) return undefined;
  return issue.occurrences
    .filter((o) => o.roundId !== roundId && o.level !== 'ok')
    .sort((a, b) => b.at - a.at)[0];
}

/** Text block of an issue's history, for cloud review context. */
export function issueHistory(issue: Issue | undefined): string {
  if (!issue) return 'none recorded';
  return issue.occurrences
    .slice()
    .sort((a, b) => a.at - b.at)
    .map((o) => `- shift ${o.shift}: ${o.value ?? '–'} ${o.unit ? UNIT_LABEL[o.unit] : ''} [${o.level}]${o.note ? ` note: ${o.note}` : ''}`)
    .join('\n');
}
