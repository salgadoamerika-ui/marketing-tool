import { assessConversionGap } from './conversion-gap.ts';
import { getConversionSuggestionPlans } from './conversion-gap-followups.ts';
import { addDaysToDate } from './follow-ups.ts';
import type { InsightPost } from './action-insight';

export function buildConversionReview(
  selected: InsightPost,
  posts: InsightPost[],
  today: string,
  occupiedDates: string[] = [],
) {
  const comparable = posts.filter((post) =>
    post.businessId === selected.businessId
    && post.project === selected.project
    && post.status !== 'skipped'
  );
  const plan = selected.status === 'skipped' ? undefined : getConversionSuggestionPlans(comparable)[0];
  const subject = comparable.find((post) => post.id === plan?.triggerPostId) ?? selected;
  const assessment = assessConversionGap(subject, comparable);
  if (!plan || assessment.status !== 'detected') {
    return { subject, assessment, proposal: undefined };
  }

  // Results may be recorded long after a post ran; do not backdate its follow-up.
  const intendedDate = plan.date > today ? plan.date : addDaysToDate(today, 2);
  const occupied = new Set([
    ...occupiedDates,
    ...posts.filter((post) => post.businessId === selected.businessId && post.status !== 'skipped')
      .map((post) => post.date),
  ]);
  let date = intendedDate;
  let blocked = true;
  for (let nudge = 0; nudge <= 7; nudge += 1) {
    date = addDaysToDate(intendedDate, nudge);
    if (!occupied.has(date)) {
      blocked = false;
      break;
    }
  }
  return {
    subject,
    assessment,
    proposal: {
      ...plan,
      date,
      blocked,
      contentType: plan.kind === 'trust' ? 'Testimonial' : 'Book now',
    },
  };
}

export type ConversionReview = ReturnType<typeof buildConversionReview>;