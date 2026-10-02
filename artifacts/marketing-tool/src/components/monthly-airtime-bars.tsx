import type { MonthlyAirtimeRow } from '@/lib/monthly-airtime';

export function MonthlyAirtimeBars({
  rows,
  getTone,
}: {
  rows: MonthlyAirtimeRow[];
  getTone: (service: string) => string;
}) {
  return (
    <div className="monthly-airtime">
      <div className="monthly-airtime-caption">Airtime balance</div>
      <ul className="monthly-airtime-list" aria-label="Monthly airtime by service">
        {rows.map((row) => {
          const share = `${row.sharePercent.toFixed(1)}%`;
          const detail = `${row.postCount} calendar ${row.postCount === 1 ? 'post' : 'posts'} · ${share} adjusted airtime`
            + (row.maintenance ? ' · Maintenance floor'
              : row.boosted && row.postCount > 1 ? ' · Above-average views: 50% boost' : '');
          return (
            <li className="monthly-airtime-row" key={row.service} title={detail}>
              <span className="monthly-airtime-name">{row.service}</span>
              <div
                className="monthly-airtime-track"
                role="meter"
                aria-label={`${row.service} airtime`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={row.sharePercent}
                aria-valuetext={`${detail} · ${row.tag}`}
              >
                <span
                  className={`airtime-fill event-${getTone(row.service)}`}
                  style={{ width: `${row.sharePercent}%` }}
                />
              </div>
              <span className={`monthly-airtime-tag monthly-airtime-tag-${row.tag.toLowerCase()}`}>
                {row.tag}
              </span>
            </li>
          );
        })}
      </ul>
      <details className="monthly-airtime-method">
        <summary>How airtime is balanced</summary>
        <p>
          Calendar posts set the mix. Above-average views add a 50% weight boost after
          three measured posts for that service. Services with zero or one post, or
          consistently weak results, hold an 8% minimum. The rest is shared by weighted
          post count. With no service above its floor, bars share equally. Tied leaders
          use service order for the Peak tag.
        </p>
      </details>
    </div>
  );
}