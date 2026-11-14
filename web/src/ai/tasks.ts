// Prompts and task wrappers. Device tasks get a single small step card; cloud tasks get the
// long material (manual, history). Every result passes deterministic guards before use.

import compiledPackSchema from '../../../shared/schema/compiled-pack.schema.json';
import observationSchema from '../../../shared/schema/observation.schema.json';
import askSchema from '../../../shared/schema/ask.schema.json';
import handoverSchema from '../../../shared/schema/handover.schema.json';
import reviewSchema from '../../../shared/schema/escalation-review.schema.json';
import trendSchema from '../../../shared/schema/trend.schema.json';
import { runStructured, type StructuredResult } from './hybrid';
import type { AskAnswer, CompiledPack, HandoverFacts, Issue, ObservationInterpretation } from '../domain/types';
import { UNIT_LABEL } from '../domain/measure';

// ---------------------------------------------------------------- cloud: compile manual → pack

export async function compileManual(manualText: string): Promise<StructuredResult<CompiledPack>> {
  const instructions = `You are a procedure compiler for industrial inspection rounds.
Convert the equipment manual below into a procedure pack for a SMALL on-device model used by field technicians.

Rules:
- Create one step per inspection check in the daily round section. Use ids "s1", "s2", ...
- "instruction": one or two short imperative sentences (max 220 characters), plain English.
- "section": the manual section number, e.g. "2.1".
- "measurement": only if the check needs a numeric reading. unit must be one of bar, kPa, psi, degC, degF, mm/s.
- "thresholds": ONLY limits that are written in the manual. NEVER invent, infer or round a limit.
  Map "normal range A to B" to attention lt A and attention gt B. Map "X or higher is an alarm" to alarm gte X.
  Map "below X ... is an alarm" to alarm lt X; "above X" to gt X; "should not exceed X" to attention gt X.
  "sourceQuote" must be copied VERBATIM from the manual (one sentence) and must contain the number and unit.
- "expectedObservations": short phrases for what a normal check looks/sounds like (from the manual).
- "observationChecklist": 2-4 short items a good technician note should state for this check (e.g. "noise type", "location").
- "safety" and "generalSafety": precautions from the manual, each with a VERBATIM "sourceQuote".
- "escalation": for each check, the manual's escalation rules that apply to it. "condition" states the condition AND the
  required action in the manual's words, e.g. "<condition>: <action the manual requires>". "sourceQuote" is the VERBATIM
  sentence that requires the action (often in a general escalation section). Include the rule for repeated deviations
  across shifts if the manual has one.
- "sourceRevision": the manual revision string.
- Keep every text field short. Do not add steps the manual does not describe.`;
  const parts = [{ text: `${instructions}\n\n--- MANUAL START ---\n${manualText}\n--- MANUAL END ---` }];
  return runStructured<CompiledPack>('compile', compiledPackSchema, parts);
}

// ---------------------------------------------------------------- device: interpret observation

export function interpretPrompt(stepCard: string, observation: string, reading?: string) {
  return `You help a field technician write a clear inspection note. Use ONLY the step card below.
Do not give repair instructions. Do not invent numbers.

${stepCard}

${reading ? `READING ENTERED: ${reading}\n` : ''}TECHNICIAN NOTE: "${observation}"

Return JSON:
- summary: one short sentence restating the note in plain words.
- category: normal | noise | leak | heat | smell | visual | other.
- concerns: short phrases for anything in the note that differs from EXPECTED (empty if none).
- missingInfo: items from "A GOOD NOTE STATES" that the note does not mention (copy the item text exactly).
- followUpQuestion: ONE short question asking for the most important missing item, or "" if nothing is missing.
- beyondPack: true if the note describes something the step card does not cover.
- confidence: low | medium | high.`;
}

export async function interpretObservation(stepCard: string, observation: string, reading: string | undefined, meta: { roundId: string; stepId: string }) {
  return runStructured<ObservationInterpretation>('interpret', observationSchema, interpretPrompt(stepCard, observation, reading), meta);
}

// ---------------------------------------------------------------- device: clarification question

export function askPrompt(stepCard: string, question: string) {
  return `Answer the technician's question using ONLY the approved step card below.
If the card does not contain the answer, set answerable=false and answer "Not covered by the approved procedure."
Never contradict or relax a limit or safety rule. Do not give repair instructions. Max 2 sentences.

${stepCard}

QUESTION: "${question}"

Return JSON: answerable (boolean), answer (string), packFactsUsed (short quotes from the card you relied on).`;
}

export async function askStep(stepCard: string, question: string, meta: { roundId: string; stepId: string }) {
  return runStructured<AskAnswer>('ask', askSchema, askPrompt(stepCard, question), meta);
}

// ---------------------------------------------------------------- device: handover narrative

export function factsText(f: HandoverFacts) {
  const lines = [`EQUIPMENT: ${f.equipmentName}`, `SHIFT: ${f.shift}`, 'MEASUREMENTS:'];
  for (const m of f.measurements) {
    lines.push(m.unit ? `- ${m.title}: ${m.value ?? '–'} ${UNIT_LABEL[m.unit]} [${m.level}]` : `- ${m.title}: checked (visual check, no reading) [${m.level}]`);
  }
  lines.push('OPEN ISSUES:');
  if (!f.openIssues.length) lines.push('- none');
  for (const i of f.openIssues) {
    lines.push(`- id=${i.issueId} | ${i.title} | level=${i.level} | seen on ${i.occurrences} shift(s)${i.lastNote ? ` | note: ${i.lastNote}` : ''}`);
  }
  lines.push(`PENDING CLOUD REVIEWS: ${f.pendingEscalations.length}`);
  return lines.join('\n');
}

export async function writeHandoverNarrative(f: HandoverFacts, meta: { roundId: string }) {
  const prompt = `Write a shift handover for the next technician using ONLY these facts. Do not add numbers, causes or events.
Never call the equipment stable, normal or fine when any reading is [attention] or [alarm]. Every check listed under MEASUREMENTS was completed this round; never say a check was skipped or not performed.

${factsText(f)}

Return JSON:
- headline: max 12 words.
- narrative: 2-3 short sentences.
- actions: one entry per OPEN ISSUE, with its exact id as issueId and one short action ("Re-measure ...", "Check ..."). Empty if no open issues.`;
  return runStructured<{ headline: string; narrative: string; actions: { issueId: string; action: string }[] }>('handover', handoverSchema, prompt, meta);
}

// ---------------------------------------------------------------- cloud: escalation review

export async function cloudReview(payload: string, meta: { roundId: string; stepId: string; escalationReason: string }) {
  const prompt = `You are a senior maintenance engineer reviewing an escalated inspection finding.
You are ADVISORY ONLY: you cannot change approved limits or procedures, and you must not tell the technician to bypass any safety control.
Base your answer on the procedure excerpt and the history provided. If information is insufficient, say so.

${payload}

Return JSON: assessment (2-3 sentences), possibleCauses (cause + basis in the provided facts), suggestedChecks (short, safe, non-invasive checks or "call supervisor"), urgency (routine|soon|immediate), packSectionsCited (manual section numbers you used).`;
  return runStructured<{ assessment: string; possibleCauses: { cause: string; basis: string }[]; suggestedChecks: string[]; urgency: string; packSectionsCited: string[] }>(
    'review',
    reviewSchema,
    prompt,
    meta,
  );
}

// ---------------------------------------------------------------- cloud: trends across shifts

export function issuesText(issues: Issue[]) {
  return issues
    .map(
      (i) =>
        `ISSUE id=${i.id} | ${i.stepTitle} | status=${i.status}\n` +
        i.occurrences
          .slice()
          .sort((a, b) => a.at - b.at)
          .map((o) => `  - shift ${o.shift}: ${o.value ?? '-'} ${o.unit ? UNIT_LABEL[o.unit] : ''} level=${o.level}${o.note ? ` note="${o.note}"` : ''}`)
          .join('\n'),
    )
    .join('\n');
}

export async function analyzeTrends(issues: Issue[]) {
  const prompt = `Identify recurring problems across shifts from this deterministic issue history.
Use ONLY these facts. Do not invent measurements or incidents. Mention a pattern only if it is visible in at least two shifts.

${issuesText(issues)}

Return JSON: summary (2 sentences), recurring (issueId exactly as given, pattern, recommendation).`;
  return runStructured<{ summary: string; recurring: { issueId: string; pattern: string; recommendation: string }[] }>('trend', trendSchema, prompt);
}
