import { type FormEvent, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { OverperformerResult } from '@/lib/overperformer';

type Props = {
  service: string;
  result: OverperformerResult;
  boost?: { budget?: number; runLength?: number };
  hasFollowUp: boolean;
  followUpDate: string;
  onBoost: (budget: number, runLength: number) => void;
  onSuggest: () => void;
};

export function OverperformerRecommendation({
  service,
  result,
  boost,
  hasFollowUp,
  followUpDate,
  onBoost,
  onSuggest,
}: Props) {
  const [isBoostOpen, setIsBoostOpen] = useState(false);
  const [budget, setBudget] = useState(boost?.budget?.toString() ?? '');
  const [runLength, setRunLength] = useState(boost?.runLength?.toString() ?? '');
  const [error, setError] = useState('');
  const [boostSaved, setBoostSaved] = useState(false);

  const handleBoost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(budget);
    const days = Number(runLength);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(days) || days <= 0) {
      setError('Enter a budget above $0 and a whole number of days.');
      return;
    }
    onBoost(amount, days);
    setError('');
    setBoostSaved(true);
    setIsBoostOpen(false);
  };

  return (
    <section aria-label="Overperformer recommendation" className="overperformer-card">
      <div className="overperformer-heading">
        <span aria-hidden="true" className="overperformer-icon"><TrendingUp size={18} strokeWidth={1.8} /></span>
        <div>
          <p className="overperformer-kicker">A standout moment</p>
          <h3>This post overperformed</h3>
        </div>
      </div>
      <p className="overperformer-copy">
        This got <strong>{result.views.toLocaleString()} views</strong> — about{' '}
        <strong>{result.multiple.toFixed(1)}x</strong> your usual for {service}.
      </p>
      <p className="overperformer-context">
        Based on an average of {Math.round(result.averageViews).toLocaleString()} views across {result.postCount} posts with views recorded.
      </p>
      <div className="overperformer-actions">
        <button
          aria-expanded={isBoostOpen}
          className="overperformer-action overperformer-action-primary"
          onClick={() => {
            setIsBoostOpen((current) => !current);
            setError('');
          }}
          type="button"
        >
          {boost?.budget ? 'Edit boost plan' : 'Boost this post'}
        </button>
        <button
          className="overperformer-action overperformer-action-secondary"
          disabled={hasFollowUp}
          onClick={onSuggest}
          type="button"
        >
          {hasFollowUp ? 'Follow-up added' : 'Make more like it'}
        </button>
      </div>
      {boostSaved && <p className="overperformer-feedback" role="status">Boost plan saved to this post.</p>}
      {hasFollowUp && <p className="overperformer-feedback" role="status">Suggested follow-up for {followUpDate}.</p>}
      {isBoostOpen && (
        <form className="overperformer-boost-form" onSubmit={handleBoost}>
          <p>Plan a boost here. This does not launch an ad on your platforms.</p>
          <div className="post-performance-fields">
            <label className="form-field">
              <span>Budget ($)</span>
              <input min="0.01" onChange={(event) => setBudget(event.target.value)} required step="0.01" type="number" value={budget} />
            </label>
            <label className="form-field">
              <span>Run length (days)</span>
              <input min="1" onChange={(event) => setRunLength(event.target.value)} required step="1" type="number" value={runLength} />
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="save-post-button" type="submit">Save boost plan</button>
        </form>
      )}
    </section>
  );
}