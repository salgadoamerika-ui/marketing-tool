import { Sparkles, X } from 'lucide-react';
import type { ActionInsight } from '@/lib/action-insight';

type Props = {
  insight: ActionInsight;
  onClose: () => void;
};

export function ActionInsightPopup({ insight, onClose }: Props) {
  return (
    <div
      className="post-modal-backdrop action-insight-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section aria-labelledby="action-insight-title" aria-modal="true" className="action-insight-popup" role="dialog">
        <button aria-label="Close insight" autoFocus className="modal-close action-insight-close" onClick={onClose} type="button">
          <X size={18} strokeWidth={1.8} />
        </button>
        <span aria-hidden="true" className="action-insight-icon"><Sparkles size={21} strokeWidth={1.8} /></span>
        <p className="action-insight-kicker">From your uploaded stats · {insight.action}</p>
        <h2 id="action-insight-title">{insight.title}</h2>
        <p className="action-insight-evidence">{insight.evidence}</p>
        <div className="action-insight-next">
          <strong>What to do next</strong>
          <p>{insight.recommendation}</p>
        </div>
        <button className="save-post-button action-insight-done" onClick={onClose} type="button">
          Got it
        </button>
      </section>
    </div>
  );
}