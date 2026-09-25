import { HeartHandshake } from 'lucide-react';
import type { ConversionGapResult } from '@/lib/conversion-gap';

type Props = {
  result: ConversionGapResult;
  service: string;
  stage: 'trust' | 'offer' | 'complete';
  scheduledDate?: string;
  laterOfferDate?: string;
};

export function ConversionGapRecommendation({
  result,
  service,
  stage,
  scheduledDate,
  laterOfferDate,
}: Props) {
  return (
    <section aria-label="Conversion gap recommendation" aria-live="polite" className="conversion-gap-card">
      <div className="conversion-gap-heading">
        <span aria-hidden="true" className="conversion-gap-icon"><HeartHandshake size={19} strokeWidth={1.8} /></span>
        <div>
          <p className="conversion-gap-kicker">Conversion gap</p>
          <h3>{stage === 'trust' ? 'Bookings are low. Build trust first.'
            : stage === 'offer' ? 'Still low. Lower the barrier.' : 'Bookings are still low.'}</h3>
        </div>
      </div>
      <p className="conversion-gap-copy">
        This got <strong>{result.views.toLocaleString()} views</strong> and{' '}
        <strong>{result.saves.toLocaleString()} saves</strong> but{' '}
        <strong>{result.bookings.toLocaleString()} bookings</strong> — bookings are below 20% of both.
      </p>
      <p className="conversion-gap-context">
        {stage === 'trust'
          ? `People engaged with ${service}, but few booked. A client testimonial can help build confidence before we try an offer.`
          : stage === 'offer'
            ? `Bookings on the ${service} testimonial are still below 20% of views and saves. An offer is the next step.`
            : `The ${service} offer also has low bookings. No further automatic post will be added.`}
      </p>
      {stage !== 'complete' && (
        <div className="conversion-gap-step">
          <span className="conversion-gap-step-label">
            {stage === 'trust' ? 'Step 1 · Build trust' : 'Step 2 · Lower the barrier'}
          </span>
          <p>{scheduledDate
            ? `Added a suggested ${stage === 'trust' ? 'Proof / client testimonial' : 'Book now / referral offer'} post to the calendar for ${scheduledDate}.`
            : `A ${stage === 'trust' ? 'client testimonial' : 'referral offer'} is recommended, but no suggestion is currently on the calendar.`}</p>
        </div>
      )}
      {stage === 'trust' && (
        <p className="conversion-gap-feedback">
          {laterOfferDate
            ? `A lower-barrier offer is also on the calendar for ${laterOfferDate}.`
            : 'If testimonial results still meet the conversion-gap rule, you can choose whether to add a lower-barrier offer.'}
        </p>
      )}
    </section>
  );
}