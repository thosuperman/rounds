import { useEffect, useState } from 'react';
import { onLedger, type LedgerEvent } from '../ai/ledger';
import { watchEscalations } from '../data/repo';
import type { Escalation } from '../domain/types';
import { useLive, useOnline, useDeviceModel } from '../hooks';
import { Card, Empty, SourceBadge, Tag } from '../ui/bits';
import { REASON_LABEL } from '../ai/escalation';
import { rc } from '../firebase';

/** Evidence view: what ran where, why, and what is still queued. */
export function Ledger() {
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  useEffect(() => {
    const off = onLedger(setEvents);
    return () => {
      off();
    };
  }, []);
  const escalations = useLive<Escalation>(watchEscalations);
  const online = useOnline();
  const [device] = useDeviceModel();
  const counts = events.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.source]: (acc[e.source] ?? 0) + 1 }), {});

  return (
    <div className="stack">
      <h2>Hybrid ledger</h2>
      <Card title="This device">
        <div className="grid2">
          <div>Network</div>
          <div>{online ? <Tag tone="ok">online</Tag> : <Tag tone="alarm">offline</Tag>}</div>
          <div>On-device model (Chrome Prompt API)</div>
          <div>
            <Tag tone={device === 'available' ? 'ok' : undefined}>{device}</Tag>
          </div>
          <div>Cloud model (Remote Config)</div>
          <div>
            <code>{rc.cloudModel()}</code> / compile <code>{rc.compileModel()}</code>
          </div>
          <div>Runs this session</div>
          <div>
            on-device {counts.ON_DEVICE ?? 0} · cloud {counts.IN_CLOUD ?? 0} · failed {counts.NONE ?? 0}
          </div>
        </div>
        <p className="muted small">The source of every AI result comes from the SDK's <code>response.inferenceSource</code>. Rule checks never use AI.</p>
      </Card>

      <Card title="Routing policy">
        <table className="facts">
          <thead>
            <tr>
              <th>Task</th>
              <th>Mode</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Measurement check</td>
              <td>Rule-based</td>
              <td>Safety-relevant: deterministic, supervisor-approved limits</td>
            </tr>
            <tr>
              <td>Check note / ask a question / handover summary</td>
              <td>
                <code>PREFER_ON_DEVICE</code>
              </td>
              <td>Short, single-turn, works offline; SDK falls back to cloud if no local model</td>
            </tr>
            <tr>
              <td>Compile manual</td>
              <td>
                <code>ONLY_IN_CLOUD</code>
              </td>
              <td>Long document, beyond on-device context</td>
            </tr>
            <tr>
              <td>Escalated review, trends</td>
              <td>
                <code>ONLY_IN_CLOUD</code>
              </td>
              <td>App-level escalation after validation failure or by request; queued when offline</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Escalation queue">
        {escalations.length === 0 && <Empty>No escalations.</Empty>}
        {escalations.map((e) => (
          <div key={e.id} className="ledger-row">
            <Tag tone={e.status === 'done' ? 'ok' : e.status === 'failed' ? 'alarm' : 'attention'}>{e.status}</Tag> {REASON_LABEL[e.reason]} · step {e.stepId} · attempts {e.attempts}
            {e.resultSource && <SourceBadge source={e.resultSource} />}
          </div>
        ))}
      </Card>

      <Card title="Inference events (this session)">
        {events.length === 0 && <Empty>No AI calls yet.</Empty>}
        {events.map((e, i) => (
          <div key={i} className="ledger-row">
            <SourceBadge source={e.source} ms={e.ms} model={e.model} /> <b>{e.task}</b> <code>{e.mode}</code> {e.ok ? <Tag tone="ok">valid</Tag> : <Tag tone="alarm">{e.error?.slice(0, 80)}</Tag>}
            {e.escalationReason && <Tag>{e.escalationReason}</Tag>} {e.online === false && <Tag tone="alarm">offline</Tag>}
          </div>
        ))}
      </Card>
    </div>
  );
}
