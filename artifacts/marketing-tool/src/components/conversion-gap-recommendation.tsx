import { HeartHandshake } from 'lucide-react';
import type { ConversionGapResult } from '@/lib/conversion-gap';

type Props = {
  result: ConversionGapResult;
  service: string;
  hasTrustSuggestion: boolean;
  hasOfferSuggestion: boolean;
  trustDate: string;
  offerDate: string;
  onBuildTrust: () => void;
  onLowerBarrier: () => void;
};

export function ConversionGapRecommendation({
  result,
  service,
  hasTrustSuggestion,
  hasOfferSuggestion,
  trustDate,
  offerDate,
  onBuildTrust,
  onLowerBarrier,
}: Props) {
  return (
    <section aria-label="Conversion gap recommendation" className="conversion-gap-card">
      <div className="conversion-gap-heading">
        <span aria-hidden="true" className="conversion-gap-icon"><HeartHandshake size={19} strokeWidth={1.8} /></span>
        <div>
          <p className="conversion-gap-kicker">Conversion gap</p>
          <h3>Interest is there. Bookings aren't yet.</h3>
        </div>
      </div>
      <p className="conversion-gap-copy">
        This got <strong>{result.views.toLocaleString()} views</strong> and{' '}
        <strong>{result.saves.toLocaleString()} saves</strong> but{' '}
        <strong>{result.bookings.toLocaleString()} bookings</strong> — bookings are below 20% of both.
      </p>
      <p className="conversion-gap-context">
        People engaged with {service}, but few booked. Trust or cost may be a barrier.
      </p>
      <div className="conversion-gap-actions">
        <button
          className="conversion-gap-action conversion-gap-action-primary"
          disabled={hasTrustSuggestion}
          onClick={onBuildTrust}
          type="button"
        >
          {hasTrustSuggestion ? 'Proof post added' : 'Build trust'}
        </button>
        <button
          className="conversion-gap-action conversion-gap-action-secondary"
          disabled={hasOfferSuggestion}
          onClick={onLowerBarrier}
          type="button"
        >
          {hasOfferSuggestion ? 'Offer post added' : 'Lower the barrier'}
        </button>
      </div>
      {hasTrustSuggestion && (
        <p className="conversion-gap-feedback" role="status">Proof / testimonial suggested for {trustDate}.</p>
      )}
      {hasOfferSuggestion && (
        <p className="conversion-gap-feedback" role="status">Book now / referral offer suggested for {offerDate}.</p>
      )}
    </section>
  );
}