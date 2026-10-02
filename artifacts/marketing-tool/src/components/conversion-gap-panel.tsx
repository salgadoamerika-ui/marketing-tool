import { useState } from 'react';
import type { ConversionReview } from '@/lib/conversion-review';

export function ConversionGapPanel({
  review,
  onAdd,
}: {
  review: ConversionReview;
  onAdd: () => void;
}) {
  const [skipped, setSkipped] = useState(false);
  const { assessment, subject, proposal } = review;
  const detected = assessment.status === 'detected';
  return (
    <section
      className={`conversion-gap-panel${detected ? ' conversion-gap-detected' : ''}`}
      aria-label="Conversion gap check"
      aria-live="polite"
    >
      <h3>{detected ? 'Conversion gap detected' : 'Conversion gap check'}</h3>
      {assessment.status === 'needs-results' ? (
        <p>Record Views, Saves, and Bookings for this post to check conversion. Enter 0 for no bookings; a blank means unknown.</p>
      ) : assessment.status === 'needs-history' ? (
        <p>{assessment.postCount}/3 measured posts for {subject.project}. This rule needs three posts in the same business and service with all three results recorded.</p>
      ) : assessment.status === 'not-detected' ? (
        <p>No conversion gap detected. Views and saves must both be positive, and bookings must be strictly below 20% of both. Equality does not trigger the rule.</p>
      ) : assessment.status === 'detected' ? (
        <>
          <p>
            “{subject.title}”: {assessment.result.views.toLocaleString()} views,{' '}
            {assessment.result.saves.toLocaleString()} saves,{' '}
            {assessment.result.bookings.toLocaleString()} bookings.
            Bookings are below 20% of both views and saves, with {assessment.postCount} measured posts for this service.
          </p>
          {proposal ? (
            <>
              <p>{proposal.kind === 'trust'
                ? 'Interest is not turning into bookings. Try a client testimonial to build trust.'
                : 'The testimonial still has a conversion gap. Try a lower-barrier referral offer with a clear booking ask.'}</p>
              <strong className="conversion-gap-next">{proposal.title}</strong>
              <p>{proposal.blocked ? 'No open date in the next week. Free a calendar slot before adding this follow-up.'
                : `Suggested date: ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${proposal.date}T12:00:00`))}.`}</p>
              {skipped ? <p>Suggestion skipped. No post was added.</p> : (
                <div className="conversion-gap-actions">
                  <button className="save-post-button" type="button" disabled={proposal.blocked} onClick={onAdd}>Add to calendar</button>
                  <button className="cancel-button" type="button" onClick={() => setSkipped(true)}>Skip suggestion</button>
                </div>
              )}
            </>
          ) : (
            <p>A conversion follow-up is already on the calendar. Record its results before adding another step.</p>
          )}
        </>
      ) : null}
    </section>
  );
}