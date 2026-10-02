import { useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import type { ConversionReview } from '@/lib/conversion-review';

export function ConversionGapPanel({ review, onAdd }: { review: ConversionReview; onAdd: () => void }) {
  const [skipped, setSkipped] = useState(false);
  const { assessment, subject, proposal, stage } = review;
  if (assessment.status !== 'detected') return null;
  const { result } = assessment;
  const message = stage === 'trust'
    ? 'People are interested, but bookings aren’t following. Something in the booking path isn’t working yet. Try a client story to build trust.'
    : stage === 'waiting-trust'
      ? 'Your client story is on the calendar. Let it run, then record its results before deciding whether to change the offer.'
      : stage === 'offer'
        ? 'The client story didn’t bring in more bookings. Lower the barrier with a clear referral offer.'
        : 'The referral offer is on the calendar. Keep tracking bookings; this alert clears when bookings improve across your recent posts.';
  return (
    <section className="conversion-gap-panel conversion-gap-detected" aria-label="Conversion gap check" aria-live="polite">
      <h3><HeartHandshake size={18} aria-hidden="true" /> {subject.project}: bookings aren’t following interest</h3>
      <p className="conversion-gap-message">{message}</p>
      <div aria-label="Your numbers from the latest three posts" className="conversion-gap-metrics">
        <span className="conversion-gap-metrics-label">Your numbers · last 3 posts</span>
        <dl>
          <div><dt>Views</dt><dd>{result.views.toLocaleString()}</dd></div>
          <div><dt>Saves</dt><dd>{result.saves.toLocaleString()}</dd></div>
          <div><dt>Bookings</dt><dd>{result.bookings.toLocaleString()}</dd></div>
        </dl>
      </div>
      {proposal && (
        <>
          <strong className="conversion-gap-next">{proposal.kind === 'trust' ? 'Step 1 · Build trust' : 'Step 2 · Lower the barrier'}: {proposal.title}</strong>
          <p>{proposal.blocked ? 'No open date in the next week. Free a calendar slot before adding this follow-up.'
            : `Suggested date: ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${proposal.date}T12:00:00`))}.`}</p>
          {skipped ? <p>Suggestion skipped. No post was added.</p> : (
            <div className="conversion-gap-actions">
              <button className="save-post-button" type="button" disabled={proposal.blocked} onClick={onAdd}>Add to calendar</button>
              <button className="cancel-button" type="button" onClick={() => setSkipped(true)}>Skip suggestion</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}