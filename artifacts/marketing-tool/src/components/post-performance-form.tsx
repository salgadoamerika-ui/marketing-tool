import { type FormEvent, useState } from 'react';

export type PostPerformance = {
  views?: number;
  saves?: number;
  bookings?: number;
};

type Metric = keyof PostPerformance;

const metrics: { key: Metric; label: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'saves', label: 'Saves' },
  { key: 'bookings', label: 'Bookings' },
];

export function PostPerformanceForm({
  performance,
  postedTime,
  onSave,
}: {
  performance?: PostPerformance;
  postedTime?: string;
  onSave: (performance: PostPerformance, postedTime?: string) => void;
}) {
  const [draft, setDraft] = useState<Record<Metric, string>>({
    views: performance?.views?.toString() ?? '',
    saves: performance?.saves?.toString() ?? '',
    bookings: performance?.bookings?.toString() ?? '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [draftPostedTime, setDraftPostedTime] = useState(postedTime ?? '');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: PostPerformance = {};

    for (const { key } of metrics) {
      const value = draft[key].trim();
      if (value === '') continue;
      const count = Number(value);
      if (!Number.isSafeInteger(count) || count < 0) {
        setError('Enter a whole number of zero or more for each result.');
        setSaved(false);
        return;
      }
      next[key] = count;
    }

    onSave(next, draftPostedTime || undefined);
    setError('');
    setSaved(true);
  };

  return (
    <form className="post-performance" onSubmit={handleSubmit}>
      <div>
        <h3>How did it do?</h3>
        <p className="post-performance-intro">Add the results for this post.</p>
      </div>
      <div className="post-performance-fields">
        {metrics.map(({ key, label }) => (
          <label className="form-field" key={key}>
            <span>{label}</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) => {
                setDraft((current) => ({ ...current, [key]: event.target.value }));
                setError('');
                setSaved(false);
              }}
              step="1"
              type="number"
              value={draft[key]}
            />
          </label>
        ))}
      </div>
      <label className="form-field post-performance-time">
        <span>Time posted (optional)</span>
        <input
          aria-describedby="post-performance-time-hint"
          onChange={(event) => {
            setDraftPostedTime(event.target.value);
            setSaved(false);
          }}
          type="time"
          value={draftPostedTime}
        />
        <small id="post-performance-time-hint">
          Leave this blank if you don’t know it. A real time can help learn timing patterns.
        </small>
      </label>
      <div className="post-performance-actions">
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p className="post-performance-saved" role="status">Results saved</p>}
        <button className="save-post-button" type="submit">Save results</button>
      </div>
    </form>
  );
}