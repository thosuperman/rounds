// The hybrid inference layer. Every generative call in the app goes through here and
// through Firebase AI Logic. Four mechanisms are kept separate on purpose:
//   1. SDK automatic fallback   — InferenceMode.PREFER_ON_DEVICE lets the SDK pick device or cloud.
//   2. App-level escalation     — this app decides to re-run a task in the cloud (see escalation.ts).
//   3. Offline queueing         — cloud work that can't run now is stored and retried (see escalation.ts).
//   4. Deterministic validation — JSON Schema + guards decide whether an output is usable.
// The reported source always comes from the SDK's `response.inferenceSource`, never from a guess.

import { getGenerativeModel, InferenceMode, InferenceSource, type GenerativeModel } from 'firebase/ai';
import Ajv, { type ValidateFunction } from 'ajv';
import { ai, rc } from '../firebase';
import type { InferenceSourceLabel } from '../domain/types';
import { recordInference } from './ledger';

export type Task = 'interpret' | 'ask' | 'handover' | 'compile' | 'review' | 'trend' | 'probe';

/** Where each task is allowed to run. Device-first tasks are short, structured, single-turn. */
export const TASK_MODE: Record<Task, (typeof InferenceMode)[keyof typeof InferenceMode]> = {
  interpret: InferenceMode.PREFER_ON_DEVICE,
  ask: InferenceMode.PREFER_ON_DEVICE,
  handover: InferenceMode.PREFER_ON_DEVICE,
  probe: InferenceMode.PREFER_ON_DEVICE,
  compile: InferenceMode.ONLY_IN_CLOUD, // long PDF/manual input: beyond on-device limits
  review: InferenceMode.ONLY_IN_CLOUD, // app-level escalation target
  trend: InferenceMode.ONLY_IN_CLOUD, // cross-shift history
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new WeakMap<object, ValidateFunction>();
function validatorFor(schema: object) {
  let v = validators.get(schema);
  if (!v) {
    // Strip annotation keys the validator doesn't need.
    const { $comment: _c, ...rest } = schema as Record<string, unknown>;
    void _c;
    v = ajv.compile(rest);
    validators.set(schema, v);
  }
  return v;
}

/** Remove keys the Gemini JSON-schema endpoint or Chrome's responseConstraint may reject. */
function modelSchema(schema: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(schema, (k, v) => (k === '$comment' ? undefined : v)));
}

const EN = [{ type: 'text' as const, languages: ['en'] }];

const modelCache = new Map<string, GenerativeModel>();
export function modelFor(task: Task, schema: object | null, opts: { forceMode?: (typeof InferenceMode)[keyof typeof InferenceMode] } = {}) {
  const mode = opts.forceMode ?? TASK_MODE[task];
  const cloudModel = task === 'compile' ? rc.compileModel() : rc.cloudModel();
  const key = `${task}|${mode}|${cloudModel}|${schema ? JSON.stringify(schema).length : 0}`;
  let m = modelCache.get(key);
  if (!m) {
    const s = schema ? modelSchema(schema) : undefined;
    m = getGenerativeModel(ai, {
      mode,
      onDeviceParams: {
        createOptions: { expectedInputs: EN, expectedOutputs: EN },
        promptOptions: s ? { responseConstraint: s } : undefined,
      },
      inCloudParams: {
        model: cloudModel,
        generationConfig: s
          ? { responseMimeType: 'application/json', responseJsonSchema: s, temperature: 0.2 }
          : { temperature: 0.2 },
      },
    });
    modelCache.set(key, m);
  }
  return { model: m, mode, cloudModel };
}

export function toLabel(src: unknown): InferenceSourceLabel {
  if (src === InferenceSource.ON_DEVICE) return 'ON_DEVICE';
  if (src === InferenceSource.IN_CLOUD) return 'IN_CLOUD';
  return 'NONE';
}

export class StructuredOutputError extends Error {
  readonly source: InferenceSourceLabel;
  readonly raw: string;
  constructor(message: string, source: InferenceSourceLabel, raw: string) {
    super(message);
    this.source = source;
    this.raw = raw;
  }
}

export class InferenceUnavailableError extends Error {
  readonly offline: boolean;
  /** True when a cloud fallback was possible but the user has not allowed it. */
  readonly needsConsent: boolean;
  constructor(message: string, offline: boolean, cause?: unknown, needsConsent = false) {
    super(message, { cause });
    this.offline = offline;
    this.needsConsent = needsConsent;
  }
}

// ---------------------------------------------------------------- cloud fallback consent
// PREFER_ON_DEVICE would silently send a technician's note to the cloud on a device without a
// local model. Device tasks therefore only fall back to the cloud after an explicit opt-in.
const FALLBACK_KEY = 'rounds.cloudFallbackConsent';
export function cloudFallbackAllowed() {
  try {
    return localStorage.getItem(FALLBACK_KEY) === 'yes';
  } catch {
    return false;
  }
}
export function setCloudFallbackAllowed(v: boolean) {
  try {
    localStorage.setItem(FALLBACK_KEY, v ? 'yes' : 'no');
  } catch {
    /* storage unavailable: stays off */
  }
}

export interface StructuredResult<T> {
  data: T;
  source: InferenceSourceLabel;
  ms: number;
  raw: string;
  model: string;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * Run one structured task. Throws StructuredOutputError (with the real source) when the output
 * fails JSON parsing or schema validation, and InferenceUnavailableError when neither backend
 * could run (e.g. offline on a device without a local model).
 */
export async function runStructured<T>(
  task: Task,
  schema: object,
  parts: string | Part[],
  meta: { escalationReason?: string; roundId?: string; stepId?: string; forceMode?: (typeof InferenceMode)[keyof typeof InferenceMode] } = {},
): Promise<StructuredResult<T>> {
  const { model, mode, cloudModel } = modelFor(task, schema, { forceMode: meta.forceMode });
  if (mode === InferenceMode.PREFER_ON_DEVICE && !cloudFallbackAllowed() && (await deviceAvailability()) !== 'available') {
    await recordInference({ task, mode, source: 'NONE', ms: 0, ok: false, error: 'no local model; cloud fallback not allowed', ...meta });
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    throw new InferenceUnavailableError('No on-device model here, and cloud fallback is off. Nothing was sent.', offline, undefined, true);
  }
  const t0 = performance.now();
  let raw = '';
  let source: InferenceSourceLabel = 'NONE';
  try {
    const res = await model.generateContent(typeof parts === 'string' ? parts : (parts as never));
    source = toLabel(res.response.inferenceSource);
    raw = res.response.text();
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    await recordInference({ task, mode, source: 'NONE', ms, ok: false, error: String(e), ...meta });
    throw new InferenceUnavailableError(offline ? 'Offline and no on-device model available.' : `Inference failed: ${e}`, offline, e);
  }
  const ms = Math.round(performance.now() - t0);
  const modelName = source === 'ON_DEVICE' ? onDeviceModelName() : cloudModel;
  let data: T;
  try {
    data = JSON.parse(stripFences(raw)) as T;
  } catch {
    await recordInference({ task, mode, source, ms, ok: false, error: 'invalid JSON', model: modelName, ...meta });
    throw new StructuredOutputError('Model returned invalid JSON.', source, raw);
  }
  const validate = validatorFor(schema);
  if (!validate(data)) {
    const err = ajv.errorsText(validate.errors);
    await recordInference({ task, mode, source, ms, ok: false, error: `schema: ${err}`, model: modelName, ...meta });
    throw new StructuredOutputError(`Output failed schema validation: ${err}`, source, raw);
  }
  await recordInference({ task, mode, source, ms, ok: true, model: modelName, ...meta });
  return { data, source, ms, raw, model: modelName };
}

function stripFences(s: string) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}

export function onDeviceModelName() {
  return 'gemini-nano (Chrome built-in)';
}

// ---------------------------------------------------------------- device model status

export type DeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';

interface LanguageModelStatic {
  availability(opts?: object): Promise<string>;
}

/** Ask Chrome directly whether a local model exists. Used for status display only. */
export async function deviceAvailability(): Promise<DeviceAvailability> {
  const LM = (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;
  if (!LM) return 'unsupported';
  try {
    return (await LM.availability({ expectedInputs: EN, expectedOutputs: EN })) as DeviceAvailability;
  } catch {
    return 'unavailable';
  }
}

/**
 * Must be called from a user gesture. Starts or completes the on-device model download via the
 * Firebase AI Logic SDK (initializeDeviceModel), reporting progress 0..1.
 */
export async function prepareDeviceModel(onProgress: (p: number) => void) {
  const { model } = modelFor('probe', null);
  await model.initializeDeviceModel(onProgress);
}
