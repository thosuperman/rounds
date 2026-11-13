import { acknowledgeHandover, watchHandovers } from '../data/repo';
import type { Handover } from '../domain/types';
import { useLive } from '../hooks';
import { UNIT_LABEL } from '../domain/measure';
import { Card, Empty, LevelBadge, SourceBadge, Tag, time } from '../ui/bits';
import type { Session } from '../data/workspace';
import { REASON_LABEL } from '../ai/escalation';

export function Handovers({ session }: { session: Session }) {
  const hs = useLive<Handover>(watchHandovers);
  return (
    <div className="stack">
      <h2>Shift handovers</h2>
      {hs.length === 0 && <Empty>No handovers yet. Completing a round creates one, even offline.</Empty>}
      {hs.map((h) => (
        <HandoverCard key={h.id} h={h} session={session} />
      ))}
    </div>
  );
}

function HandoverCard({ h, session }: { h: Handover; session: Session }) {
  const f = h.facts;
  return (
    <Card title={`${f.equipmentName} · ${f.shift}`} right={<span className="muted">{time(f.completedAt)}</span>}>
      {h.narrative && (
        <div className="ai-out">
          <div className="row between">
            <span className="ai-label">{h.narrativeSource === 'DETERMINISTIC' ? 'Template summary' : 'AI-written summary (facts below are authoritative)'}</span>
            <SourceBadge source={h.narrativeSource} />
          </div>
          <p>
            <b>{h.narrative.headline}</b>
          </p>
          <p>{h.narrative.narrative}</p>
        </div>
      )}
      {h.narrativeRejectedReason && <p className="warn small">{h.narrativeRejectedReason}</p>}

      <h4>Measurements (recorded, rule-checked)</h4>
      <table className="facts">
        <tbody>
          {f.measurements.map((m) => (
            <tr key={m.stepId}>
              <td>{m.title}</td>
              <td className="num">
                {m.value ?? '–'} {m.unit ? UNIT_LABEL[m.unit] : ''}
              </td>
              <td>
                {m.unit ? <LevelBadge level={m.level} /> : <Tag>Checked</Tag>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Needs attention next shift</h4>
      {f.openIssues.length === 0 && <p className="muted">No open issues.</p>}
      <ul className="actions">
        {f.openIssues.map((i) => {
          const action = h.narrative?.actions.find((a) => a.issueId === i.issueId)?.action;
          return (
            <li key={i.issueId}>
              <LevelBadge level={i.level} /> <b>{i.title}</b> — seen on {i.occurrences} shift(s){i.lastNote ? ` · “${i.lastNote}”` : ''}
              {action && <div className="muted">→ {action}</div>}
            </li>
          );
        })}
      </ul>
      {f.pendingEscalations.length > 0 && (
        <p className="queued">
          ⏳ {f.pendingEscalations.length} cloud review(s) pending: {f.pendingEscalations.map((p) => REASON_LABEL[p.reason]).join(', ')}
        </p>
      )}
      {h.acknowledgedBy ? (
        <Tag tone="ok">Acknowledged by {h.acknowledgedBy}</Tag>
      ) : (
        <button className="btn" onClick={() => acknowledgeHandover(h.id, session.displayName)}>
          Acknowledge handover
        </button>
      )}
    </Card>
  );
}
