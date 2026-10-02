import { assessConversionGap } from './conversion-gap.ts';
import { getConversionSequence } from './conversion-gap-followups.ts';
import { addDaysToDate } from './follow-ups.ts';
import { getFlatPostState, getMaintenanceSuggestionDate } from './flat-post-ladder.ts';
import type { InsightPost } from './action-insight';
import type { ServiceDefinition } from './services.ts';
import { describeContentPacing, getPacedSuggestionDate } from './content-pacing.ts';

export function buildConversionReview(
  selected: InsightPost,
  posts: InsightPost[],
  today: string,
  occupiedDates: string[] = [],
  services?: ServiceDefinition[],
) {
  const service = services?.find((item) => item.businessId === selected.businessId && item.name === selected.project);
  if (services && !service) throw new Error('Choose a saved Service or Campaign before planning content.');
  const pacingNote = service && services ? describeContentPacing(service, services, today) : undefined;
  const comparable = posts.filter((post) =>
    post.businessId === selected.businessId
    && post.project === selected.project
    && post.status !== 'skipped'
  );
  const assessment = assessConversionGap(selected, comparable);
  const subject = assessment.status === 'detected'
    ? comparable.find((post) => post.id === assessment.result.latestPostId)! : selected;
  const sequence = getConversionSequence(selected, comparable, today);
  const plan = sequence?.plan;
  if (!plan || assessment.status !== 'detected') {
    return { subject, assessment, stage: sequence?.stage, proposal: undefined, pacingNote };
  }

  // Results may be recorded long after a post ran; do not backdate its follow-up.
  let intendedDate = plan.date > today ? plan.date : addDaysToDate(today, 2);
  if (service?.mode !== 'campaign' && getFlatPostState(selected, comparable, today).action === 'maintenance') {
    const monthlyDate = getMaintenanceSuggestionDate(selected, comparable, today);
    if (monthlyDate > intendedDate) intendedDate = monthlyDate;
  }
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
  if (services) {
    const paced = getPacedSuggestionDate(service!, services, posts, today, intendedDate, occupiedDates);
    if (!paced) return { subject, assessment, stage: sequence?.stage, proposal: undefined, pacingNote };
    date = paced;
    blocked = false;
  }
  return {
    subject,
    assessment,
    stage: sequence?.stage,
    pacingNote,
    proposal: {
      ...plan,
      date,
      blocked,
      contentType: plan.kind === 'trust' ? 'Testimonial' : 'Book now',
    },
  };
}

export type ConversionReview = ReturnType<typeof buildConversionReview>;