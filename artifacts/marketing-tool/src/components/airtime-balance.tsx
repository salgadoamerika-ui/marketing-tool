import type { ServiceAirtimeAllocation } from '@/lib/airtime-allocation';

type Props = {
  monthLabel: string;
  allocations: ServiceAirtimeAllocation[];
  getTone: (service: string) => string;
};

function signalLabel(signal: ServiceAirtimeAllocation['signal']): string {
  if (signal === 'above-average') return 'Above average';
  if (signal === 'consistently-weak') return 'Consistently weak';
  if (signal === 'flat') return 'Flat';
  return 'Need more data';
}

function signalDetail(allocation: ServiceAirtimeAllocation): string {
  if (allocation.signal === 'above-average') {
    return 'Recent views are above the service average';
  }
  if (allocation.signal === 'consistently-weak') {
    return 'Recent results are consistently below average';
  }
  if (allocation.signal === 'flat') return 'Recent results are near the service average';
  return 'More measured posts are needed before performance changes airtime';
}

export function AirtimeBalance({ monthLabel, allocations, getTone }: Props) {
  return (
    <section aria-labelledby="airtime-balance-title" className="insight-card tint airtime-card">
      <p className="insight-eyebrow">{monthLabel} allocation</p>
      <h2 id="airtime-balance-title">This month’s balance</h2>
      <p className="airtime-intro">
        Colored timelines show weekly airtime. Every service keeps a steady monthly presence.
      </p>
      <div aria-label="Weekly post allocation by service" className="airtime-list">
        {allocations.map((allocation) => (
          <article className="airtime-service" key={allocation.service}>
            <div className="airtime-service-heading">
              <span className={`airtime-dot focus-dot ${getTone(allocation.service)}`} />
              <strong>{allocation.service}</strong>
            </div>
            <div
              aria-label={`${allocation.service} share of weekly airtime`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={allocation.sharePercent}
              className="airtime-track"
              role="progressbar"
            >
              <span
                className={`airtime-fill event-${getTone(allocation.service)}`}
                style={{ width: `${Math.min(100, allocation.sharePercent)}%` }}
              />
            </div>
            <div className="airtime-service-meta">
              {allocation.inSeason && <span className="airtime-season">In season</span>}
              {allocation.tryNewAngle && <span className="airtime-new-angle">Try a new angle</span>}
              <span className={`airtime-signal airtime-signal-${allocation.signal}`}>
                {signalLabel(allocation.signal)}
              </span>
            </div>
            <small className="airtime-evidence">{signalDetail(allocation)}</small>
          </article>
        ))}
      </div>
      <details className="airtime-method">
        <summary>How the score works</summary>
        <p>
          Base 1 point; in-season +0.75; recent views above the prior average +0.5; three
          consecutive results below the service average −0.85. Performance adjustments need
          3 measured posts. In-season volume wins over weak results, with “Try a new angle”
          instead. Scores have a 0.25 floor; weekly slots are then shared by score.
        </p>
      </details>
    </section>
  );
}