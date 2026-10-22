import type { ActionInsight, InsightPost, InsightProposal } from './action-insight.ts';
import { addDaysToDate } from './follow-ups.ts';
import { getPacedSuggestionDate } from './content-pacing.ts';
import type { ServiceDefinition } from './services.ts';

type SkippablePost = InsightPost & { distribution?: 'organic' | 'paid' };

export function buildSkipAlternativeInsight(
  post: SkippablePost, posts: InsightPost[], today: string,
  occupiedDates: string[], services: ServiceDefinition[], availableTypes: string[],
): ActionInsight {
  const isPaid = post.distribution === 'paid' || /^(boost|paid ad)$/i.test(post.contentType);
  const options = isPaid
    ? ['Repost', post.contentType, 'Insight']
    : ({
      Testimonial: ['Proof', 'Inside look', 'Insight'],
      Proof: ['Inside look', 'Insight'],
      'Inside look': ['Insight', 'Proof'],
      Insight: ['Recap', 'Inside look'],
      Announcement: ['Insight', 'Inside look'],
      'Book now': ['Insight', 'Proof'],
      Enrollment: ['Insight', 'Proof'],
      Pricing: ['Insight', 'Proof'],
      Promo: ['Insight', 'Proof'],
      'Last chance': ['Insight', 'Proof'],
      Repost: ['Insight', 'Recap'],
    }[post.contentType] ?? ['Insight', 'Inside look', 'Recap']);
  const contentType = options.find((name) => availableTypes.includes(name) && (isPaid || name !== post.contentType));
  const message = isPaid ? 'No boost? Try an organic repost instead.'
    : post.contentType === 'Testimonial' && contentType === 'Proof'
      ? 'Skip the testimonial? A quick proof post is lighter.'
      : contentType === 'Insight' ? 'A short, useful tip is a lighter way to keep the conversation going.'
        : contentType === 'Inside look' ? 'A quick inside look can show the experience without a full story.'
          : contentType === 'Recap' ? 'A brief recap keeps the useful parts visible with less to prepare.'
            : 'A small piece of proof can keep the same idea moving.';
  const base: ActionInsight = {
    sourcePostId: post.id,
    action: 'skipped',
    title: 'A lighter way forward',
    evidence: `“${post.title}” is marked skipped, not deleted.`,
    recommendation: contentType ? `${message} Only if it feels useful — add it or leave it here.`
      : 'Skipped and kept in your record. There is no enabled content type for a lighter alternative right now.',
    beats: [],
    proposals: [],
  };
  if (!contentType) return base;
  const service = services.find((item) => item.businessId === post.businessId && item.name === post.project);
  if (!service) throw new Error('Choose a saved Service or Campaign before planning content.');
  if (service.mode === 'campaign' && (service.status === 'dormant' || today > service.endDate)) return {
    ...base, recommendation: 'Skipped and kept in your record. This Campaign has ended, so no new post will be suggested.',
  };
  const anchor = post.date > today ? post.date : today;
  const existing = posts.filter((item) => item.businessId === post.businessId && item.project === post.project
    && item.status !== 'skipped' && item.id !== post.id
    && (!isPaid || item.distribution !== 'paid')
    && ((item.sourcePostId === post.id && item.suggestionKind === 'skip-alternative')
      || (item.contentType === contentType && item.date > today && item.date <= addDaysToDate(anchor, 7))))
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  if (existing) return {
    ...base,
    recommendation: `${message} A matching move is already on your calendar; nothing new needs adding.`,
    beats: [{ state: 'scheduled', contentType: existing.contentType, title: existing.title,
      date: existing.date, existingPostId: existing.id }],
  };
  const date = getPacedSuggestionDate(service, services, posts, today, addDaysToDate(anchor, 2), occupiedDates);
  if (!date) return { ...base, recommendation: `${message} There is no open date within the current window, so nothing was added.` };
  const proposal: InsightProposal = {
    kind: 'skip-alternative', triggerPostId: post.id, sourcePostId: post.id,
    contentType, title: `${post.project}: ${isPaid ? 'an organic repost' : `a quick ${contentType.toLowerCase()}`}`,
    date, distribution: 'organic',
  };
  return { ...base, proposals: [proposal], beats: [{ state: 'suggested', contentType,
    title: proposal.title, date, proposal }] };
}
