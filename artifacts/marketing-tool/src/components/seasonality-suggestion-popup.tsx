import { Sparkles } from 'lucide-react';
import type { SeasonalityFinding } from '@/lib/seasonality';

type Props = {
  service: string;
  finding: SeasonalityFinding;
  onAccept: () => void;
  onAskNextSeason: () => void;
};

function monthName(month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long' })
    .format(new Date(2026, month - 1, 1));
}

export function SeasonalitySuggestionPopup({
  service,
  finding,
  onAccept,
  onAskNextSeason,
}: Props) {
  const month = monthName(finding.month);
  const years = finding.yearsObserved.join(' and ');

  return (
    <aside
      aria-labelledby="seasonality-suggestion-title"
      aria-live="polite"
      className="action-insight-popup seasonality-popup"
    >
      <div className="action-insight-topline">
        <span aria-hidden="true" className="action-insight-icon"><Sparkles size={17} strokeWidth={1.8} /></span>
        <p className="action-insight-kicker">A seasonal pattern</p>
      </div>
      <h2 id="seasonality-suggestion-title">
        Looks like {service} spikes every {month}. Want me to treat that as its season?
      </h2>
      <p className="action-insight-evidence">
        Across {years}, posts averaged {Math.round(finding.averageViews).toLocaleString()} views
        in {month}, compared with {Math.round(finding.comparisonAverageViews).toLocaleString()} in
        other months.
      </p>
      <div className="action-insight-actions">
        <button className="save-post-button action-insight-add" onClick={onAccept} type="button">
          Yes, add {month}
        </button>
        <button className="cancel-button action-insight-skip" onClick={onAskNextSeason} type="button">
          Ask next season
        </button>
      </div>
    </aside>
  );
}