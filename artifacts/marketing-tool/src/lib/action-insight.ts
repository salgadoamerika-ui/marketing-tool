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

export type ActionInsight = {
  action: InsightAction;
  title: string;
  evidence: string;
  recommendation: string;
  proposal?: InsightProposal;
};

const sequenceReasons: Record<string, string> = {
  'Announcement→Insight': 'An announcement introduces the service. A useful insight gives people context before asking them to book.',
  'Announcement→Book now': 'The insight step is already planned. A clear booking ask is the next step.',
  'Insight→Book now': 'After sharing something useful, make it easy for interested people to book.',
  'Inside look→Proof': 'An inside look shows the process; real proof can back it up before the booking ask.',
  'Inside look→Book now': 'The proof step is already planned. Now make the next action clear.',
  'Proof→Book now': 'After showing proof, give interested people a clear way to book.',
  'Book now→Proof': 'After a booking ask, real proof can help answer remaining hesitation.',
  'Recap→Insight': 'Follow a recap with something useful to keep the conversation going.',
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
    return {
      action,
      title: 'Keep this step in the sequence',
      evidence: `${evidence} You marked it as skipped.`,
      recommendation: hasResults
        ? 'This post also has saved results. Check whether it actually ran before deciding what to schedule next.'
        : `Since this ${post.contentType.toLowerCase()} was skipped, revisit it before moving to the next content step.`,
      ...(!hasResults && !alreadyRescheduled ? {
        proposal: {
          kind: 'reschedule' as const,
          triggerPostId: post.id,
          sourcePostId: post.id,
          contentType: post.contentType,
          title: `${post.project}: revisit ${post.title}`,
          date: addDaysToDate(post.date > today ? post.date : today, 2),
        },
      } : {}),
    };
  }

  // The sequence is a content plan, not a performance-learning rule. It does
  // not need three measured posts; performance rules enforce their own gate.
  const anchor = post.date > today ? post.date : today;
  const plans = getFollowUpPlans({ ...post, date: anchor }, posts.filter((item) => item.status !== 'skipped'));
  const next = plans.find((plan) => !plan.existingPostId);

  if (!next) {
    return {
      action,
      title: plans.length ? 'The next steps are already planned' : 'No follow-up mapped yet',
      evidence,
      recommendation: plans.length
        ? `Your ${post.project} follow-up${plans.length === 1 ? ' is' : 's are'} already on the calendar. There is no need to add a duplicate.`
        : `There is no next content step mapped for ${post.contentType}. No calendar post was added.`,
    };
  }

  return {
    action,
    title: `${next.contentType} is next in the sequence`,
    evidence,
    recommendation: `${sequenceReasons[`${post.contentType}→${next.contentType}`] ?? `Follow this ${post.contentType.toLowerCase()} with a ${next.contentType.toLowerCase()} post.`} This is a content-sequence suggestion, not a claim about performance.`,
    proposal: {
      kind: 'automatic',
      triggerPostId: post.id,
      sourcePostId: post.id,
      contentType: next.contentType,
      title: `${post.project}: ${next.label}`,
      date: next.date,
    },
  };
}