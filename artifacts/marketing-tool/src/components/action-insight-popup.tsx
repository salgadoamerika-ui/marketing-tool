import { Sparkles, X } from 'lucide-react';
import type { ActionInsight } from '@/lib/action-insight';

type Props = {
  insight: ActionInsight;
  onAdd: () => void;
  onSkip: () => void;
};

export function ActionInsightPopup({ insight, onAdd, onSkip }: Props) {
  return (
    <aside aria-labelledby="action-insight-title" aria-live="polite" className="action-insight-popup">
      <button aria-label="Dismiss insight" className="modal-close action-insight-close" onClick={onSkip} type="button">
        <X size={16} strokeWidth={1.8} />
      </button>
      <div className="action-insight-topline">
        <span aria-hidden="true" className="action-insight-icon"><Sparkles size={17} strokeWidth={1.8} /></span>
        <p className="action-insight-kicker">A little insight · {insight.action}</p>
      </div>
      <h2 id="action-insight-title">{insight.title}</h2>
      <p className="action-insight-evidence">{insight.evidence}</p>
      <div className="action-insight-next">
        <strong>Why this next step?</strong>
        <p>{insight.recommendation}</p>
      </div>
      {insight.beats.length > 0 && (
        <div aria-label="Content sequence" className="action-insight-beats">
          {insight.beats.map((beat, index) => (
            <div className={`action-insight-proposal action-insight-beat-${beat.state}`} key={`${beat.contentType}-${beat.date}-${index}`}>
              <span>
                {beat.state === 'scheduled'
                  ? 'Your next beat is already set'
                  : beat.state === 'blocked' ? 'No open date this week' : 'Suggested next beat'}
              </span>
              <strong>{beat.title}</strong>
              <small>
                {beat.state === 'blocked' ? 'Choose another date to keep this step.' : <>
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  }).format(new Date(`${beat.date}T12:00:00`))} · {beat.contentType}
                </>}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="action-insight-actions">
        {insight.proposals.length > 0 && (
          <button className="save-post-button action-insight-add" onClick={onAdd} type="button">
            {insight.proposals.length > 1 ? 'Add missing moves' : 'Add to calendar'}
          </button>
        )}
        <button className="cancel-button action-insight-skip" onClick={onSkip} type="button">
          {insight.proposals.length ? 'Skip' : 'Got it'}
        </button>
      </div>
    </aside>
  );
}