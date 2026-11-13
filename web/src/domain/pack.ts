// Deterministic verification of cloud-compiled procedure packs.
// The cloud model proposes; this code checks every claim against the source manual,
// and only a supervisor can approve. Unverified packs cannot be published.

import type { CompiledPack, PackStep, ProcedurePack, Threshold, Unit } from './types';
import { UNIT_LABEL } from './measure';

/** Conservative token estimate (chars / 3.2), deliberately pessimistic for small models. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

/**
 * Token budget for one step card. The smallest documented on-device context is
 * Apple Foundation Models / Android at ~4,096 tokens for input+output; we keep the
 * card well under that so the observation, instructions and JSON output fit.
 */
export const STEP_CARD_TOKEN_BUDGET = 900;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function quoteInSource(quote: string, source: string): boolean {
  const q = normalize(quote).replace(/^[.…\s]+|[.…\s]+$/g, '');
  if (q.length < 8) return false;
  return normalize(source).includes(q);
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));
}

const UNIT_WORDS: Record<Unit, string[]> = {
  bar: ['bar'],
  kPa: ['kpa'],
  psi: ['psi'],
  degC: ['°c', 'degc', ' c '],
  degF: ['°f', 'degf'],
  'mm/s': ['mm/s'],
  none: [],
};

export type FindingSeverity = 'blocker' | 'warning';

export interface Finding {
  key: string; // approval key of the item, or step id
  severity: FindingSeverity;
  message: string;
}

export function thresholdKey(stepId: string, i: number) {
  return `${stepId}.t${i}`;
}
export function safetyKey(stepId: string, i: number) {
  return `${stepId}.safety${i}`;
}
export function escalationKey(stepId: string, i: number) {
  return `${stepId}.esc${i}`;
}
export function generalSafetyKey(i: number) {
  return `general.safety${i}`;
}

/** Check one threshold: quote must be verbatim in the manual and contain the value (and unit). */
export function verifyThreshold(t: Threshold, unit: Unit, source: string): string[] {
  const problems: string[] = [];
  if (!quoteInSource(t.sourceQuote, source)) problems.push('Source quote not found verbatim in the manual.');
  if (!numbersIn(t.sourceQuote).some((n) => Math.abs(n - t.value) < 1e-9)) {
    problems.push(`Value ${t.value} does not appear in its source quote.`);
  }
  const words = UNIT_WORDS[unit];
  if (words.length && !words.some((w) => ` ${normalize(t.sourceQuote)} `.includes(w))) {
    problems.push(`Unit ${UNIT_LABEL[unit]} does not appear in its source quote.`);
  }
  return problems;
}

/** All items in a pack that require explicit supervisor approval. */
export function approvalKeys(pack: CompiledPack): string[] {
  const keys: string[] = pack.generalSafety.map((_, i) => generalSafetyKey(i));
  for (const s of pack.steps) {
    s.thresholds.forEach((_, i) => keys.push(thresholdKey(s.id, i)));
    s.safety.forEach((_, i) => keys.push(safetyKey(s.id, i)));
    s.escalation.forEach((_, i) => keys.push(escalationKey(s.id, i)));
  }
  return keys;
}

/** Text the on-device model sees for one step. Small by construction. */
export function renderStepCard(pack: CompiledPack, step: PackStep): string {
  const unit = step.measurement?.unit ?? 'none';
  const lines = [
    `EQUIPMENT: ${pack.equipment.name} (${pack.equipment.model})`,
    `STEP ${step.id}: ${step.title} [manual §${step.section}]`,
    `INSTRUCTION: ${step.instruction}`,
  ];
  if (step.measurement) lines.push(`MEASURE: ${step.measurement.label} in ${UNIT_LABEL[unit]}`);
  if (step.thresholds.length) {
    lines.push('LIMITS (approved): ' + step.thresholds.map((t) => `${t.level} ${t.comparator} ${t.value}`).join('; '));
  }
  if (step.expectedObservations.length) lines.push('EXPECTED: ' + step.expectedObservations.join('; '));
  if (step.observationChecklist.length) lines.push('A GOOD NOTE STATES: ' + step.observationChecklist.join('; '));
  if (step.safety.length) lines.push('SAFETY: ' + step.safety.map((s) => s.text).join(' '));
  if (step.escalation.length) lines.push('ESCALATE WHEN: ' + step.escalation.map((e) => e.condition).join(' '));
  return lines.join('\n');
}

const PARAPHRASE = 'AI wording is not verbatim from the manual. Compare it with the quote before approving.';

export function verifyPack(pack: CompiledPack, source: string): Finding[] {
  const findings: Finding[] = [];
  if (!pack.steps.length) findings.push({ key: 'pack', severity: 'blocker', message: 'Pack has no steps.' });
  const ids = new Set<string>();
  pack.generalSafety.forEach((s, i) => {
    if (!quoteInSource(s.sourceQuote, source)) {
      findings.push({ key: generalSafetyKey(i), severity: 'blocker', message: 'Safety quote not found in the manual.' });
    } else if (!quoteInSource(s.text, source)) {
      findings.push({ key: generalSafetyKey(i), severity: 'warning', message: PARAPHRASE });
    }
  });
  for (const step of pack.steps) {
    if (ids.has(step.id)) findings.push({ key: step.id, severity: 'blocker', message: `Duplicate step id ${step.id}.` });
    ids.add(step.id);
    const unit = step.measurement?.unit ?? 'none';
    if (step.thresholds.length && !step.measurement) {
      findings.push({ key: step.id, severity: 'blocker', message: 'Thresholds defined without a measurement.' });
    }
    step.thresholds.forEach((t, i) => {
      for (const p of verifyThreshold(t, unit, source)) {
        findings.push({ key: thresholdKey(step.id, i), severity: 'blocker', message: p });
      }
    });
    step.safety.forEach((s, i) => {
      if (!quoteInSource(s.sourceQuote, source)) {
        findings.push({ key: safetyKey(step.id, i), severity: 'blocker', message: 'Safety quote not found in the manual.' });
      } else if (!quoteInSource(s.text, source)) {
        findings.push({ key: safetyKey(step.id, i), severity: 'warning', message: PARAPHRASE });
      }
    });
    step.escalation.forEach((e, i) => {
      if (!quoteInSource(e.sourceQuote, source)) {
        findings.push({ key: escalationKey(step.id, i), severity: 'blocker', message: 'Escalation quote not found in the manual.' });
      }
    });
    if (step.measurement && step.thresholds.length === 0) {
      findings.push({ key: step.id, severity: 'warning', message: 'Measurement has no limits; readings will not be checked.' });
    }
    const tokens = estimateTokens(renderStepCard(pack, step));
    if (tokens > STEP_CARD_TOKEN_BUDGET) {
      findings.push({
        key: step.id,
        severity: 'blocker',
        message: `Step card is ~${tokens} tokens, over the on-device budget of ${STEP_CARD_TOKEN_BUDGET}. Shorten it.`,
      });
    }
  }
  return findings;
}

export interface PublishGate {
  canPublish: boolean;
  blockers: Finding[];
  unapproved: string[];
}

/** Safety and escalation items may be excluded by the supervisor. Limits never: fix them by recompiling. */
export function isExcludable(key: string) {
  return !/\.t\d+$/.test(key);
}

export function publishGate(pack: CompiledPack, source: string, approved: string[], excluded: string[] = []): PublishGate {
  const ex = new Set(excluded.filter(isExcludable));
  const blockers = verifyPack(pack, source).filter((f) => f.severity === 'blocker' && !ex.has(f.key));
  const set = new Set(approved);
  const unapproved = approvalKeys(pack).filter((k) => !set.has(k) && !ex.has(k));
  return { canPublish: blockers.length === 0 && unapproved.length === 0, blockers, unapproved };
}

/** The pack as technicians and the on-device model see it: excluded items removed. */
export function publishedView<P extends CompiledPack & { approval?: { excludedItems?: string[] } }>(pack: P): P {
  const ex = new Set((pack.approval?.excludedItems ?? []).filter(isExcludable));
  if (!ex.size) return pack;
  return {
    ...pack,
    generalSafety: pack.generalSafety.filter((_, i) => !ex.has(generalSafetyKey(i))),
    steps: pack.steps.map((s) => ({
      ...s,
      safety: s.safety.filter((_, i) => !ex.has(safetyKey(s.id, i))),
      escalation: s.escalation.filter((_, i) => !ex.has(escalationKey(s.id, i))),
    })),
  };
}

export function stepTokenEstimates(pack: CompiledPack): Record<string, number> {
  return Object.fromEntries(pack.steps.map((s) => [s.id, estimateTokens(renderStepCard(pack, s))]));
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isApproved(pack: ProcedurePack): boolean {
  return pack.status === 'approved' && !!pack.approval;
}

/**
 * Verbatim text of one manual section (e.g. "2.3"): from its heading to the next heading of the
 * same or higher level. Used as cloud-only context for escalated reviews.
 */
export function manualSection(manual: string, section: string, maxChars = 4000): string {
  const lines = manual.split('\n');
  const esc = section.replace(/\./g, '\\.');
  const start = lines.findIndex((l) => new RegExp(`^#{1,6}\\s+${esc}(\\s|\\.|$)`).test(l));
  if (start < 0) return '';
  const level = (lines[start].match(/^#+/) ?? [''])[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim().slice(0, maxChars);
}
