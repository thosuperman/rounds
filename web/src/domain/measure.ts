// Deterministic measurement parsing, unit conversion and threshold checks.
// No AI is involved in any of this: safety-relevant decisions are rule-based.

import type { CheckResult, Comparator, Level, Threshold, Unit } from './types';

const UNIT_ALIASES: Record<string, Unit> = {
  bar: 'bar',
  kpa: 'kPa',
  psi: 'psi',
  c: 'degC',
  '°c': 'degC',
  degc: 'degC',
  celsius: 'degC',
  f: 'degF',
  '°f': 'degF',
  degf: 'degF',
  'mm/s': 'mm/s',
  mms: 'mm/s',
  'mm/sec': 'mm/s',
};

const FAMILY: Record<Unit, string> = {
  bar: 'pressure',
  kPa: 'pressure',
  psi: 'pressure',
  degC: 'temperature',
  degF: 'temperature',
  'mm/s': 'velocity',
  none: 'none',
};

export const UNIT_LABEL: Record<Unit, string> = {
  bar: 'bar',
  kPa: 'kPa',
  psi: 'psi',
  degC: '°C',
  degF: '°F',
  'mm/s': 'mm/s',
  none: '',
};

export class MeasurementError extends Error {}

export interface ParsedMeasurement {
  value: number;
  unit: Unit;
}

/**
 * Parse a technician-entered reading such as "4.2", "4,2 bar", "420kPa", "78 °C", "5.1 mm/s".
 * If no unit is given, the expected unit is assumed. Rejects ambiguous input.
 */
export function parseMeasurement(raw: string, expected: Unit): ParsedMeasurement {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) throw new MeasurementError('Enter a value.');
  const m = text.match(/^([-+]?\d+(?:[.,]\d+)?)\s*([a-zA-Z°/]+(?:\/[a-zA-Z]+)?)?$/);
  if (!m) throw new MeasurementError(`Could not read "${raw}". Enter a number, e.g. 4.2`);
  const value = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(value)) throw new MeasurementError(`"${raw}" is not a number.`);
  let unit: Unit = expected;
  if (m[2]) {
    const alias = UNIT_ALIASES[m[2].toLowerCase()];
    if (!alias) throw new MeasurementError(`Unknown unit "${m[2]}". Use ${UNIT_LABEL[expected]}.`);
    unit = alias;
  }
  if (FAMILY[unit] !== FAMILY[expected]) {
    throw new MeasurementError(`Expected a ${FAMILY[expected]} in ${UNIT_LABEL[expected]}, got ${UNIT_LABEL[unit]}.`);
  }
  return { value: convert(value, unit, expected), unit: expected };
}

export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  // to SI-ish base
  const toBase: Record<Unit, (v: number) => number> = {
    bar: (v) => v * 100, // kPa
    kPa: (v) => v,
    psi: (v) => v * 6.894757,
    degC: (v) => v,
    degF: (v) => ((v - 32) * 5) / 9,
    'mm/s': (v) => v,
    none: (v) => v,
  };
  const fromBase: Record<Unit, (v: number) => number> = {
    bar: (v) => v / 100,
    kPa: (v) => v,
    psi: (v) => v / 6.894757,
    degC: (v) => v,
    degF: (v) => (v * 9) / 5 + 32,
    'mm/s': (v) => v,
    none: (v) => v,
  };
  return round(fromBase[to](toBase[from](value)), 3);
}

function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function compare(value: number, c: Comparator, limit: number): boolean {
  switch (c) {
    case 'lt':
      return value < limit;
    case 'lte':
      return value <= limit;
    case 'gt':
      return value > limit;
    case 'gte':
      return value >= limit;
  }
}

const RANK: Record<Level, number> = { ok: 0, attention: 1, alarm: 2 };

export function worse(a: Level, b: Level): Level {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Evaluate a value against APPROVED thresholds only. */
export function checkValue(value: number, unit: Unit, thresholds: Threshold[]): CheckResult {
  const fired = thresholds
    .filter((t) => compare(value, t.comparator, t.value))
    .sort((a, b) => RANK[b.level] - RANK[a.level]);
  const level = fired.reduce<Level>((acc, t) => worse(acc, t.level), 'ok');
  return { level, fired, value, unit };
}

export function describeThreshold(t: Threshold, unit: Unit): string {
  const sym = { lt: '<', lte: '≤', gt: '>', gte: '≥' }[t.comparator];
  return `${t.level === 'alarm' ? 'Alarm' : 'Attention'} if ${sym} ${t.value} ${UNIT_LABEL[unit]}`;
}
