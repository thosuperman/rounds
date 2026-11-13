// Domain types shared across the app. The JSON schemas in /shared/schema are the
// contract with the models; these types mirror them.

export type Unit = 'bar' | 'kPa' | 'psi' | 'degC' | 'degF' | 'mm/s' | 'none';
export type Level = 'ok' | 'attention' | 'alarm';
export type Comparator = 'lt' | 'lte' | 'gt' | 'gte';

export interface Quoted {
  sourceQuote: string;
}

export interface Threshold extends Quoted {
  level: 'attention' | 'alarm';
  comparator: Comparator;
  value: number;
}

export interface SafetyItem extends Quoted {
  text: string;
}

export interface EscalationRule extends Quoted {
  condition: string;
}

export interface Measurement {
  key: string;
  label: string;
  unit: Unit;
}

export interface PackStep {
  id: string;
  title: string;
  instruction: string;
  section: string;
  measurement?: Measurement;
  thresholds: Threshold[];
  expectedObservations: string[];
  observationChecklist: string[];
  safety: SafetyItem[];
  escalation: EscalationRule[];
}

/** What the cloud compiler returns (unverified). */
export interface CompiledPack {
  equipment: { name: string; model: string };
  title: string;
  sourceRevision: string;
  generalSafety: SafetyItem[];
  steps: PackStep[];
}

export type PackStatus = 'draft' | 'approved' | 'retired';

export interface Approval {
  /** keys like "s1.t0" (threshold), "s1.safety0", "s1.esc0", "general.safety0" */
  approvedItems: string[];
  /** Safety/escalation items the supervisor rejected; removed from what technicians see. */
  excludedItems?: string[];
  approvedBy: string;
  approvedAt: number;
}

export interface SourceDoc {
  name: string;
  revision: string;
  sha256: string;
  chars: number;
}

export interface CompileProvenance {
  model: string;
  inferenceSource: InferenceSourceLabel;
  compiledAt: number;
  durationMs: number;
}

/** A stored procedure pack (draft or approved). Approved packs are immutable. */
export interface ProcedurePack extends CompiledPack {
  id: string;
  equipmentId: string;
  version: number;
  status: PackStatus;
  source: SourceDoc;
  provenance: CompileProvenance;
  approval?: Approval;
  stepTokenEstimates: Record<string, number>;
  demoOnly: boolean;
}

export type InferenceSourceLabel = 'ON_DEVICE' | 'IN_CLOUD' | 'DETERMINISTIC' | 'QUEUED' | 'NONE';

export interface CheckResult {
  level: Level;
  /** Thresholds that fired, worst first. */
  fired: Threshold[];
  /** Value converted into the pack unit. */
  value: number;
  unit: Unit;
}

export interface Entry {
  stepId: string;
  raw: string;
  value?: number;
  unit?: Unit;
  check?: CheckResult;
  observation?: string;
  interpretation?: ObservationInterpretation;
  interpretationSource?: InferenceSourceLabel;
  recordedAt: number;
  recordedBy: string;
}

export interface ObservationInterpretation {
  summary: string;
  category: 'normal' | 'noise' | 'leak' | 'heat' | 'smell' | 'visual' | 'other';
  concerns: string[];
  missingInfo: string[];
  followUpQuestion: string;
  beyondPack: boolean;
  confidence: 'low' | 'medium' | 'high';
}

export interface AskAnswer {
  answerable: boolean;
  answer: string;
  packFactsUsed: string[];
}

export type RoundStatus = 'assigned' | 'in_progress' | 'completed';

export interface Round {
  id: string;
  packId: string;
  packVersion: number;
  equipmentId: string;
  equipmentName: string;
  shift: string;
  assignee: string;
  status: RoundStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type IssueStatus = 'open' | 'resolved';

export interface IssueOccurrence {
  roundId: string;
  shift: string;
  at: number;
  level: Level;
  value?: number;
  unit?: Unit;
  note?: string;
}

/** Deterministic issue record keyed by equipment+step, tracked across shifts. */
export interface Issue {
  id: string; // `${equipmentId}__${stepId}`
  equipmentId: string;
  stepId: string;
  stepTitle: string;
  status: IssueStatus;
  worstLevel: Level;
  occurrences: IssueOccurrence[];
  firstSeen: number;
  lastSeen: number;
}

export type EscalationReason =
  | 'invalid_output'
  | 'missing_information'
  | 'beyond_pack'
  | 'exceeds_device_capability'
  | 'user_request'
  | 'no_local_model';

export type EscalationStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Escalation {
  id: string; // deterministic idempotency key
  roundId: string;
  stepId: string;
  reason: EscalationReason;
  status: EscalationStatus;
  /** Exactly what will be sent to the cloud, shown to the user before consent. */
  payload: string;
  consentAt: number;
  createdAt: number;
  attempts: number;
  leaseUntil?: number;
  result?: unknown;
  resultSource?: InferenceSourceLabel;
  error?: string;
  completedAt?: number;
}

export interface HandoverFacts {
  roundId: string;
  equipmentName: string;
  shift: string;
  completedAt: number;
  measurements: { stepId: string; title: string; value?: number; unit?: Unit; level: Level }[];
  openIssues: { issueId: string; title: string; level: Level; occurrences: number; lastNote?: string }[];
  pendingEscalations: { id: string; stepId: string; reason: EscalationReason }[];
}

export interface Handover {
  id: string;
  roundId: string;
  facts: HandoverFacts;
  narrative?: { headline: string; narrative: string; actions: { issueId: string; action: string }[] };
  narrativeSource: InferenceSourceLabel;
  narrativeRejectedReason?: string;
  createdAt: number;
  acknowledgedBy?: string;
}
