// Deterministic guards applied to every model output before it is shown or stored.

import type { AskAnswer, ObservationInterpretation } from './types';

/** Numbers that appear in text (e.g. "78", "4.5", "7,1"). Ordinal shift labels like "B" are not numbers. */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => String(Number(m[0].replace(',', '.'))));
}

/**
 * Anti-fabrication guard: model prose may only mention numbers present in the facts it was given.
 * Returns the offending numbers (empty = pass).
 */
export function unsupportedNumbers(output: string, facts: string): string[] {
  const allowed = new Set(numbersIn(facts));
  return [...new Set(numbersIn(output))].filter((n) => !allowed.has(n));
}

export interface GuardResult<T> {
  ok: boolean;
  value?: T;
  reasons: string[];
  /** Items removed deterministically (shown to the user, not silently hidden). */
  dropped?: string[];
}

const MAX_SUMMARY = 160;

/** Validate and clean an on-device observation interpretation against the step's checklist. */
export function guardInterpretation(
  out: ObservationInterpretation,
  checklist: string[],
  observation: string,
  stepCard: string,
  opts: { measurementLabel?: string; hasReading?: boolean } = {},
): GuardResult<ObservationInterpretation> {
  const reasons: string[] = [];
  const label = opts.measurementLabel?.toLowerCase() ?? '';
  // A recorded reading already covers "the reading" items; the model often misses that.
  const coveredByReading = (m: string) => {
    const x = m.toLowerCase();
    if (!opts.hasReading) return false;
    if (/\breading\b|\bvalue\b|\blevel\b/.test(x)) return true;
    const labelWords = label.split(/[^a-z]+/).filter((w) => w.length > 3);
    return labelWords.some((w) => x.includes(w));
  };
  // Numeric judgements belong to the rule engine. Drop AI concerns that carry numbers so a model
  // can never contradict the deterministic limit check (e.g. claiming an alarm level was reached).
  const droppedConcerns = out.concerns.filter((c) => /\d/.test(c));
  const concerns = out.concerns.filter((c) => !/\d/.test(c));
  const allowed = new Map(checklist.map((c) => [c.toLowerCase(), c]));
  // Only keep missing-info items that are real checklist items (model may paraphrase or invent).
  const missingInfo = out.missingInfo
    .map((m) => allowed.get(m.toLowerCase()) ?? checklist.find((c) => c.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(c.toLowerCase())))
    .filter((m): m is string => !!m && !coveredByReading(m));
  const bad = unsupportedNumbers(`${out.summary} ${concerns.join(' ')} ${out.followUpQuestion}`, `${observation}\n${stepCard}`);
  if (bad.length) reasons.push(`mentions numbers not in the note or pack: ${bad.join(', ')}`);
  if (!out.summary.trim()) reasons.push('empty summary');
  return {
    ok: reasons.length === 0,
    value: {
      ...out,
      summary: out.summary.slice(0, MAX_SUMMARY),
      concerns,
      missingInfo: [...new Set(missingInfo)],
      followUpQuestion: missingInfo.length ? out.followUpQuestion : '',
    },
    reasons,
    dropped: droppedConcerns,
  };
}

export function guardAnswer(out: AskAnswer, stepCard: string, question: string): GuardResult<AskAnswer> {
  const reasons: string[] = [];
  const bad = unsupportedNumbers(out.answer, `${stepCard}\n${question}`);
  if (bad.length) reasons.push(`answer contains numbers not in the approved pack: ${bad.join(', ')}`);
  if (out.answerable && !out.answer.trim()) reasons.push('empty answer');
  return { ok: reasons.length === 0, value: out, reasons };
}

/** Words that suggest the model is telling someone to bypass a safety control. */
const UNSAFE_PATTERNS = [
  /bypass/i,
  /disable (the )?(guard|interlock|alarm|lock)/i,
  /remove (the )?(guard|cover)/i,
  /ignore (the )?(alarm|limit|procedure)/i,
  /without (lock ?out|loto)/i,
  /touch the (housing|casing)/i,
];

export function unsafeInstruction(text: string): boolean {
  return UNSAFE_PATTERNS.some((p) => p.test(text));
}
