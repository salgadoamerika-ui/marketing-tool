import { useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import type { ConversionReview } from '@/lib/conversion-review';

export function ConversionGapPanel({ review, onAdd }: { review: ConversionReview; onAdd: () => void }) {
  const [skipped, setSkipped] = useState(false);
  const { assessment, subject, proposal, stage } = review;
  if (assessment.status !== 'detected') return null;
  const { result } = assessment;
  return (
    <section className="conversion-gap-panel conversion-gap-detected" aria-label="Conversion gap check" aria-live="polite">
      <h3><HeartHandshake size={18} aria-hidden="true" /> Conversion gap · {subject.project}</h3>
      <p>
        Across the latest 3 measured posts: {result.views.toLocaleString()} views,{' '}
        {result.saves.toLocaleString()} saves, and {result.bookings.toLocaleString()} bookings.
        {' '}{(result.bookingRate * 100).toFixed(2)}% of views converted to bookings, below 2%;
        {' '}{result.lowConversionPosts}/3 posts show low conversion. People are interested, but few are booking.
      </p>
      {stage === 'trust' ? <p>Interest isn’t converting — let’s try proof first.</p>
        : stage === 'waiting-trust' ? <p>Your trust post is on the calendar. Let it run and record its results before considering an offer.</p>
          : stage === 'offer' ? <p>Trust didn’t move it — time to lower the barrier with a referral offer.</p>
            : <p>Your referral offer is already on the calendar. Keep recording results; this flag clears when the latest three posts recover.</p>}
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