import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { checkValue, convert, MeasurementError, parseMeasurement } from './measure';
import { approvalKeys, publishGate, quoteInSource, renderStepCard, estimateTokens, STEP_CARD_TOKEN_BUDGET, verifyPack, verifyThreshold } from './pack';
import { guardAnswer, guardInterpretation, unsafeInstruction, unsupportedNumbers } from './guards';
import { buildFacts, guardNarrative, repairActions, templateNarrative } from './handover';
import type { CompiledPack, ProcedurePack, Round } from './types';

const shared = path.resolve(__dirname, '../../../shared');
const manual = fs.readFileSync(path.join(shared, 'fixtures/manual-aqualift-cp40.md'), 'utf8');
const reference = JSON.parse(fs.readFileSync(path.join(shared, 'fixtures/pack-aqualift-cp40.reference.json'), 'utf8')) as CompiledPack;

describe('measurement parser', () => {
  it('parses plain numbers in the expected unit', () => {
    expect(parseMeasurement('4.2', 'bar')).toEqual({ value: 4.2, unit: 'bar' });
  });
  it('accepts comma decimals and explicit units', () => {
    expect(parseMeasurement('4,2 bar', 'bar').value).toBe(4.2);
    expect(parseMeasurement('78 °C', 'degC').value).toBe(78);
    expect(parseMeasurement('5.1 mm/s', 'mm/s').value).toBe(5.1);
  });
  it('converts compatible units into the pack unit', () => {
    expect(parseMeasurement('420 kPa', 'bar').value).toBe(4.2);
    expect(parseMeasurement('176 F', 'degC').value).toBe(80);
    expect(convert(60, 'psi', 'bar')).toBeCloseTo(4.137, 3);
  });
  it('rejects wrong unit families, unknown units and garbage', () => {
    expect(() => parseMeasurement('78 bar', 'degC')).toThrow(MeasurementError);
    expect(() => parseMeasurement('4.2 furlongs', 'bar')).toThrow(MeasurementError);
    expect(() => parseMeasurement('about four', 'bar')).toThrow(MeasurementError);
    expect(() => parseMeasurement('', 'bar')).toThrow(MeasurementError);
    expect(() => parseMeasurement('4.2.1', 'bar')).toThrow(MeasurementError);
  });
});

describe('deterministic thresholds', () => {
  const [pressure, temp, vib] = reference.steps;
  it('classifies pressure bands', () => {
    expect(checkValue(3.8, 'bar', pressure.thresholds).level).toBe('ok');
    expect(checkValue(2.8, 'bar', pressure.thresholds).level).toBe('attention');
    expect(checkValue(2.4, 'bar', pressure.thresholds).level).toBe('alarm');
    expect(checkValue(5.0, 'bar', pressure.thresholds).level).toBe('attention'); // "above 5.0" is alarm, 5.0 itself is not
    expect(checkValue(5.01, 'bar', pressure.thresholds).level).toBe('alarm');
  });
  it('respects inclusive comparators', () => {
    expect(checkValue(70, 'degC', temp.thresholds).level).toBe('ok');
    expect(checkValue(70.1, 'degC', temp.thresholds).level).toBe('attention');
    expect(checkValue(80, 'degC', temp.thresholds).level).toBe('alarm');
    expect(checkValue(7.1, 'mm/s', vib.thresholds).level).toBe('alarm');
    expect(checkValue(4.5, 'mm/s', vib.thresholds).level).toBe('ok');
  });
  it('lists fired thresholds worst first', () => {
    const r = checkValue(2.0, 'bar', pressure.thresholds);
    expect(r.fired[0].level).toBe('alarm');
    expect(r.fired).toHaveLength(2);
  });
});

describe('pack verification', () => {
  it('reference pack passes with no blockers', () => {
    expect(verifyPack(reference, manual).filter((f) => f.severity === 'blocker')).toEqual([]);
  });
  it('rejects an invented threshold (value not in the quote)', () => {
    const t = { ...reference.steps[1].thresholds[1], value: 85 };
    expect(verifyThreshold(t, 'degC', manual)).toContain('Value 85 does not appear in its source quote.');
  });
  it('rejects a paraphrased quote', () => {
    expect(quoteInSource('Bearing temperature must stay below 70 °C', manual)).toBe(false);
    expect(quoteInSource('The bearing temperature should not exceed 70 °C during normal operation.', manual)).toBe(true);
  });
  it('rejects a quote whose unit differs', () => {
    const t = { level: 'alarm' as const, comparator: 'gte' as const, value: 7.1, sourceQuote: 'Vibration of 7.1 mm/s or higher is an alarm condition.' };
    expect(verifyThreshold(t, 'bar', manual).some((p) => p.includes('Unit'))).toBe(true);
  });
  it('blocks publication until every item is approved', () => {
    const keys = approvalKeys(reference);
    expect(publishGate(reference, manual, []).canPublish).toBe(false);
    expect(publishGate(reference, manual, keys.slice(1)).unapproved).toEqual([keys[0]]);
    expect(publishGate(reference, manual, keys).canPublish).toBe(true);
  });
  it('blocks publication of an unverified pack even if approved', () => {
    const bad: CompiledPack = structuredClone(reference);
    bad.steps[0].thresholds[0].value = 3.3;
    expect(publishGate(bad, manual, approvalKeys(bad)).canPublish).toBe(false);
  });
  it('keeps every step card within the on-device token budget', () => {
    for (const s of reference.steps) expect(estimateTokens(renderStepCard(reference, s))).toBeLessThan(STEP_CARD_TOKEN_BUDGET);
  });
  it('flags oversized step cards', () => {
    const big: CompiledPack = structuredClone(reference);
    big.steps[0].instruction = 'x'.repeat(5000);
    expect(verifyPack(big, manual).some((f) => f.message.includes('on-device budget'))).toBe(true);
  });
});

describe('output guards', () => {
  const card = renderStepCard(reference, reference.steps[2]);
  it('detects fabricated numbers', () => {
    expect(unsupportedNumbers('Vibration is 9.3 mm/s', 'limit 7.1')).toEqual(['9.3']);
    expect(unsupportedNumbers('alarm at 7.1', 'alarm gte 7.1')).toEqual([]);
  });
  it('drops missing-info items that are not on the checklist', () => {
    const r = guardInterpretation(
      { summary: 'Squealing noise', category: 'noise', concerns: ['squeal'], missingInfo: ['location of noise', 'operator mood'], followUpQuestion: 'Where is the noise?', beyondPack: false, confidence: 'high' },
      reference.steps[2].observationChecklist,
      'squealing',
      card,
    );
    expect(r.ok).toBe(true);
    expect(r.value?.missingInfo).toEqual(['location of noise']);
  });
  it('drops numeric AI concerns and reading items already covered by a recorded reading', () => {
    const r = guardInterpretation(
      { summary: 'Squeal and warm housing', category: 'noise', concerns: ['Vibration equal to or greater than 7.1 mm/s', 'warm housing'], missingInfo: ['vibration velocity', 'vibration level', 'unusual noise description'], followUpQuestion: 'What is the vibration?', beyondPack: false, confidence: 'medium' },
      ['vibration velocity', 'vibration level', 'unusual noise description'],
      'squeal, warm 5.2',
      card,
      { measurementLabel: 'Vibration Velocity', hasReading: true },
    );
    expect(r.ok).toBe(true);
    expect(r.value?.concerns).toEqual(['warm housing']);
    expect(r.dropped).toEqual(['Vibration equal to or greater than 7.1 mm/s']);
    expect(r.value?.missingInfo).toEqual(['unusual noise description']);
  });
  it('rejects interpretations that invent numbers', () => {
    const r = guardInterpretation(
      { summary: 'Vibration probably 12 mm/s', category: 'noise', concerns: [], missingInfo: [], followUpQuestion: '', beyondPack: false, confidence: 'low' },
      [],
      'it shakes',
      card,
    );
    expect(r.ok).toBe(false);
  });
  it('rejects answers with limits not in the pack', () => {
    expect(guardAnswer({ answerable: true, answer: 'Alarm is at 9 mm/s', packFactsUsed: [] }, card, 'what is the alarm').ok).toBe(false);
    expect(guardAnswer({ answerable: true, answer: 'Alarm at 7.1 mm/s or higher.', packFactsUsed: ['alarm gte 7.1'] }, card, 'what is the alarm').ok).toBe(true);
  });
  it('flags unsafe instructions', () => {
    expect(unsafeInstruction('You can bypass the interlock to restart')).toBe(true);
    expect(unsafeInstruction('Call the supervisor and log the reading')).toBe(false);
  });
});

describe('handover', () => {
  const pack: ProcedurePack = {
    ...reference,
    id: 'p1',
    equipmentId: 'cp40-a',
    version: 1,
    status: 'approved',
    source: { name: 'm', revision: 'C', sha256: 'x', chars: 1 },
    provenance: { model: 'm', inferenceSource: 'IN_CLOUD', compiledAt: 0, durationMs: 0 },
    stepTokenEstimates: {},
    demoOnly: true,
  };
  const round: Round = { id: 'r3', packId: 'p1', packVersion: 1, equipmentId: 'cp40-a', equipmentName: 'CP-40', shift: 'Night', assignee: 'u', status: 'completed', createdAt: 0 };
  const entries = [
    { stepId: 's1', raw: '3.8', value: 3.8, unit: 'bar' as const, check: { level: 'ok' as const, fired: [], value: 3.8, unit: 'bar' as const }, recordedAt: 1, recordedBy: 'u' },
    { stepId: 's2', raw: '81', value: 81, unit: 'degC' as const, check: { level: 'alarm' as const, fired: [], value: 81, unit: 'degC' as const }, recordedAt: 2, recordedBy: 'u' },
  ];
  const issues = [
    { id: 'cp40-a__s2', equipmentId: 'cp40-a', stepId: 's2', stepTitle: 'Bearing temperature', status: 'open' as const, worstLevel: 'alarm' as const, firstSeen: 0, lastSeen: 2, occurrences: [{ roundId: 'r3', shift: 'Night', at: 2, level: 'alarm' as const, value: 81, unit: 'degC' as const }] },
  ];
  const facts = buildFacts(round, pack, entries, issues, []);
  it('builds facts only from records', () => {
    expect(facts.measurements.map((m) => m.level)).toEqual(['ok', 'alarm', 'ok']);
    expect(facts.measurements[2].value).toBeUndefined();
    expect(facts.openIssues).toHaveLength(1);
  });
  it('template narrative covers every open issue', () => {
    const t = templateNarrative(facts);
    expect(guardNarrative(t, facts, JSON.stringify(facts))).toEqual([]);
  });
  it('rejects narratives that invent numbers, and repairs dropped issues', () => {
    const bad = { headline: 'Temp hit 95', narrative: 'x', actions: [] };
    const r = guardNarrative(bad, facts, JSON.stringify(facts));
    expect(r.some((x) => x.includes('95'))).toBe(true);
    const { narrative, replaced } = repairActions({ ...bad, actions: [{ issueId: 'nope', action: 'Check pump' }] }, facts);
    expect(narrative.actions.map((a) => a.issueId)).toEqual(facts.openIssues.map((i) => i.issueId));
    expect(replaced.some((x) => x.includes('unknown'))).toBe(true);
    expect(replaced.some((x) => x.includes('missing'))).toBe(true);
  });
});

describe('handover action repair', () => {
  it('replaces an AI action that is not about its issue', () => {
    const facts = { roundId: 'r', equipmentName: 'P', shift: 'S', completedAt: 1, measurements: [], pendingEscalations: [],
      openIssues: [{ issueId: 'p__s3', title: 'Vibration', level: 'attention' as const, occurrences: 2 }, { issueId: 'p__s2', title: 'Bearing temperature', level: 'attention' as const, occurrences: 2 }] };
    const { narrative, replaced } = repairActions({ headline: 'h', narrative: 'n', actions: [{ issueId: 'p__s3', action: 'Check Vessel for Seal/Leakage' }, { issueId: 'p__s2', action: 'Re-measure bearing temperature' }] }, facts);
    expect(replaced).toHaveLength(1);
    expect(narrative.actions[0].action).toBe('Re-check Vibration at the start of the shift.');
    expect(narrative.actions[1].action).toBe('Re-measure bearing temperature');
  });
});

describe('supervisor exclusions', () => {
  it('lets a supervisor exclude a safety item but never a limit, and strips it from the published view', async () => {
    const { publishGate, publishedView, approvalKeys } = await import('./pack');
    const keys = approvalKeys(reference);
    const safety = keys.find((k) => /safety/.test(k))!;
    const limit = keys.find((k) => /\.t\d+$/.test(k))!;
    const rest = keys.filter((k) => k !== safety && k !== limit);
    expect(publishGate(reference, manual, rest, [safety, limit]).canPublish).toBe(false); // limit still unapproved
    expect(publishGate(reference, manual, [...rest, limit], [safety]).canPublish).toBe(true);
    const view = publishedView({ ...reference, approval: { approvedItems: [...rest, limit], excludedItems: [safety, limit], approvedBy: 'x', approvedAt: 1 } });
    const count = (p: CompiledPack) => p.generalSafety.length + p.steps.reduce((n, s) => n + s.safety.length, 0);
    expect(count(view)).toBe(count(reference) - 1);
    expect(view.steps.map((s) => s.thresholds.length)).toEqual(reference.steps.map((s) => s.thresholds.length));
  });
});

describe('cloud review context', () => {
  it('extracts one manual section verbatim', async () => {
    const { manualSection } = await import('./pack');
    const sec = manualSection(manual, '2.3');
    expect(sec.startsWith('### 2.3')).toBe(true);
    expect(sec).toContain('7.1 mm/s');
    expect(sec).not.toContain('2.4');
    expect(manualSection(manual, '9.9')).toBe('');
  });
  it('finds the previous deviation from another round only', async () => {
    const { priorDeviation } = await import('./handover');
    const issue = { id: 'x', equipmentId: 'p', stepId: 's3', stepTitle: 'Vibration', status: 'open' as const, worstLevel: 'attention' as const, firstSeen: 1, lastSeen: 3,
      occurrences: [{ roundId: 'r1', shift: 'A', at: 1, level: 'attention' as const }, { roundId: 'r2', shift: 'B', at: 3, level: 'attention' as const }] };
    expect(priorDeviation(issue, 'r2')?.shift).toBe('A');
    expect(priorDeviation({ ...issue, occurrences: [issue.occurrences[1]] }, 'r2')).toBeUndefined();
  });
});

describe('handover prose guard', () => {
  const base = { roundId: 'r', equipmentName: 'P', shift: 'S', completedAt: 1, pendingEscalations: [],
    measurements: [{ stepId: 's2', title: 'Bearing temperature', value: 82, unit: 'degC' as const, level: 'alarm' as const }],
    openIssues: [{ issueId: 'p__s2', title: 'Bearing temperature', level: 'alarm' as const, occurrences: 2, lastNote: 'squeal near drive end' }] };
  it('rejects prose that calls the equipment stable while readings are outside limits', () => {
    const n = { headline: 'Pump handover', narrative: 'Pump is operating stably.', actions: [{ issueId: 'p__s2', action: 'Re-measure bearing temperature' }] };
    const r = guardNarrative(n, base, 'Bearing temperature 82 alarm 2 shifts');
    expect(r).toContain('reassuring wording while readings are outside limits');
  });
  it('rejects prose claiming a recorded step was not done', () => {
    const n = { headline: 'Handover', narrative: 'Bearing temperature is in alarm. Seal and leakage checks were not performed.', actions: [] };
    expect(guardNarrative(n, base, 'Bearing temperature 82 alarm 2 shifts')).toContain('claims a check was not done, but every step was recorded');
  });
  it('accepts an action that refers to the issue note', () => {
    const { replaced } = repairActions({ headline: 'h', narrative: 'n', actions: [{ issueId: 'p__s2', action: 'Check the squeal at the drive end' }] }, base);
    expect(replaced).toHaveLength(0);
  });
});
