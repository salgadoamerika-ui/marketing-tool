import type { PostPerformance } from '@/components/post-performance-form';
import { addDaysToDate, getFollowUpPlans } from './follow-ups.ts';

export type InsightAction = 'logged' | 'results' | 'completed' | 'skipped';
export type SuggestionKind = 'automatic' | 'reschedule';

export type InsightPost = {
  id: string;
  businessId: string;
  project: string;
  title: string;
  contentType: string;
  date: string;
  status?: 'completed' | 'skipped';
  suggestionKind?: string;
  sourcePostId?: string;
  performance?: PostPerformance;
};

export type InsightProposal = {
  kind: SuggestionKind;
  triggerPostId: string;
  sourcePostId: string;
  contentType: string;
  title: string;
  date: string;
};

export type InsightSequenceBeat = {
  state: 'suggested' | 'scheduled' | 'blocked';
  contentType: string;
  title: string;
  date: string;
  existingPostId?: string;
  proposal?: InsightProposal;
};

export type ActionInsight = {
  action: InsightAction;
  title: string;
  evidence: string;
  recommendation: string;
  beats: InsightSequenceBeat[];
  proposals: InsightProposal[];
};

const sequenceReasons: Record<string, string> = {
  'Announcement→Inside look': 'An announcement introduces the service. Show people inside the experience next.',
  'Announcement→Book now': 'The inside look is already planned. Follow it with a clear booking ask.',
  'Inside look→Testimonial': 'An inside look shows the process; a testimonial adds real proof and trust.',
  'Inside look→Proof': 'An inside look shows the process; proof backs it up before the booking ask.',
  'Inside look→Book now': 'The proof step is already planned. Now make the next action clear.',
  'Book now→Testimonial': 'After the booking ask, a client testimonial can address hesitation.',
  'Book now→Pricing': 'After building trust, clear pricing helps people decide.',
  'Enrollment→Testimonial': 'After the enrollment ask, a client testimonial can address hesitation.',
  'Enrollment→Pricing': 'After building trust, clear pricing helps people decide.',
  'Pricing→Promo': 'Once pricing is clear, a focused offer gives people a reason to act.',
  'Testimonial→Book now': 'A testimonial builds trust; follow it with a clear booking ask.',
  'Proof→Book now': 'Proof builds trust; follow it with a clear booking ask.',
  'Insight→Book now': 'After sharing something useful, offer a soft way to book.',
  'Insight→Insight': 'Follow the booking prompt with more useful content to keep the value rhythm.',
};

function uploadedNumbers(performance?: PostPerformance): string {
  const fields = [
    ['views', performance?.views],
    ['saves', performance?.saves],
    ['bookings', performance?.bookings],
  ] as const;
  const recorded = fields
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([name, value]) => `${value!.toLocaleString()} ${name}`);
  return recorded.length ? ` Uploaded results: ${recorded.join(', ')}.` : '';
}

export function buildActionInsight(
  action: InsightAction,
  post: InsightPost,
  posts: InsightPost[],
  today = post.date,
  occupiedDates: string[] = [],
): ActionInsight {
  const evidence = `“${post.title}” is a ${post.contentType} post for ${post.project}.${uploadedNumbers(post.performance)}`;

  // A skipped post has not advanced the sequence. Offer to revisit the same
  // step, not a follow-up that assumes the skipped post went live.
  if (post.status === 'skipped') {
    const hasResults = post.performance
      && [post.performance.views, post.performance.saves, post.performance.bookings]
        .every((value) => typeof value === 'number' && Number.isFinite(value));
    const alreadyRescheduled = posts.some((item) =>
      item.sourcePostId === post.id && item.suggestionKind === 'reschedule'
    );
    const proposal = !hasResults && !alreadyRescheduled ? {
      kind: 'reschedule' as const,
      triggerPostId: post.id,
      sourcePostId: post.id,
      contentType: post.contentType,
      title: `${post.project}: revisit ${post.title}`,
      date: addDaysToDate(post.date > today ? post.date : today, 2),
    } : undefined;
    const beats = proposal ? [{
      state: 'suggested' as const,
      contentType: proposal.contentType,
      title: proposal.title,
      date: proposal.date,
      proposal,
    }] : [];
    return {
      action,
      title: 'Keep this step in the sequence',
      evidence: `${evidence} You marked it as skipped.`,
      recommendation: hasResults
        ? 'This post also has saved results. Check whether it actually ran before deciding what to schedule next.'
        : `Since this ${post.contentType.toLowerCase()} was skipped, revisit it before moving to the next content step.`,
      beats,
      proposals: proposal ? [proposal] : [],
    };
  }

  const plans = getFollowUpPlans(post, posts, occupiedDates);
  const beats: InsightSequenceBeat[] = plans.map((plan) => {
    if (plan.existingPostId) {
      return {
        state: 'scheduled',
        contentType: plan.contentType,
        title: plan.existingPostTitle ?? `${post.project}: ${plan.label}`,
        date: plan.date,
        existingPostId: plan.existingPostId,
      };
    }
    if (plan.blocked) {
      return {
        state: 'blocked',
        contentType: plan.contentType,
        title: `${post.project}: ${plan.label}`,
        date: plan.date,
      };
    }
    const proposal: InsightProposal = {
      kind: 'automatic',
      triggerPostId: post.id,
      sourcePostId: post.id,
      contentType: plan.contentType,
      title: `${post.project}: ${plan.label}`,
      date: plan.date,
    };
    return {
      state: 'suggested',
      contentType: plan.contentType,
      title: proposal.title,
      date: proposal.date,
      proposal,
    };
  });
  const proposals = beats.flatMap((beat) => beat.proposal ? [beat.proposal] : []);
  const firstBeat = beats[0];
  const scheduledBeat = beats.find((beat) => beat.state === 'scheduled');
  const nextSuggestion = beats.find((beat) => beat.state === 'suggested');
  const reasonKey = nextSuggestion
    ? `${post.contentType}→${nextSuggestion.contentType}`
    : firstBeat ? `${post.contentType}→${firstBeat.contentType}` : '';

  return {
    action,
    title: firstBeat?.state === 'scheduled'
      ? 'Your next beat is already set'
      : firstBeat?.state === 'blocked'
        ? 'Your sequence needs an open date'
      : scheduledBeat && proposals.length > 0 ? 'Next moves in your sequence'
        : proposals.length > 1 ? 'Next moves in your sequence' : proposals.length === 1
          ? `${proposals[0].contentType} is next in the sequence`
          : 'Your sequence is on the calendar',
    evidence,
    recommendation: [
      scheduledBeat
        ? `Your next beat is already set: “${scheduledBeat.title}” is on the calendar, so it will not be added again.`
        : '',
      nextSuggestion
        ? sequenceReasons[reasonKey] ?? `Follow this ${post.contentType.toLowerCase()} with a ${nextSuggestion.contentType.toLowerCase()} post.`
        : '',
      beats.some((beat) => beat.state === 'blocked')
        ? 'A suggested move has no open date within the next week, so it was not added.'
        : '',
      proposals.length ? 'These are content-sequence suggestions, not claims about performance.' : '',
      !beats.length ? 'No follow-up beat is mapped for this content type.' : '',
    ].filter(Boolean).join(' '),
    beats,
    proposals,
  };
}