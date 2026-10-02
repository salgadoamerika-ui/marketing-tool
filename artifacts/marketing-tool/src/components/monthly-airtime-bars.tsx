import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { MonthlyAirtimeRow } from '@/lib/monthly-airtime';
import { serviceSeasonKey } from '@/lib/service-seasons';
import { ServiceSeasonDialog } from '@/components/service-season-dialog';

export function MonthlyAirtimeBars({
  rows,
  getTone,
  businessId,
  month,
  seasonMonthsByService,
  onSaveSeasonMonths,
}: {
  rows: MonthlyAirtimeRow[];
  getTone: (service: string) => string;
  businessId: string;
  month: number;
  seasonMonthsByService: Record<string, number[]>;
  onSaveSeasonMonths: (service: string, months: number[]) => string | undefined;
}) {
  const [editingService, setEditingService] = useState<string | null>(null);
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
              <div className="monthly-airtime-service">
                <div className="monthly-airtime-service-name">
                  <span className="monthly-airtime-name">{row.service}</span>
                  <button
                    aria-label={`Set ${row.service} in-season months`}
                    className="airtime-season-edit"
                    onClick={() => setEditingService(row.service)}
                    title={`Set ${row.service} in-season months`}
                    type="button"
                  >
                    <CalendarDays size={13} strokeWidth={1.8} />
                  </button>
                </div>
                {seasonMonthsByService[serviceSeasonKey(businessId, row.service)]?.includes(month)
                  && <span className="monthly-airtime-season">In season</span>}
              </div>
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
      {editingService && (
        <ServiceSeasonDialog
          key={editingService}
          service={editingService}
          selectedMonths={seasonMonthsByService[serviceSeasonKey(businessId, editingService)] ?? []}
          onClose={() => setEditingService(null)}
          onSave={(months) => onSaveSeasonMonths(editingService, months)}
        />
      )}
    </div>
  );
}