import type { PostPerformance } from '@/components/post-performance-form';
import { getConversionGap } from './conversion-gap.ts';
import { getConversionSuggestionPlans } from './conversion-gap-followups.ts';
import { addDaysToDate } from './follow-ups.ts';
import { getOverperformer } from './overperformer.ts';

export type InsightAction = 'logged' | 'results' | 'completed' | 'skipped';
export type SuggestionKind = 'trust' | 'offer' | 'overperformer' | 'insight' | 'reschedule';

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

function completeResults(performance?: PostPerformance): performance is Required<PostPerformance> {
  return performance !== undefined
    && [performance.views, performance.saves, performance.bookings].every(
      (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
    );
}

function resultSummary(performance: Required<PostPerformance>): string {
  return `${performance.views.toLocaleString()} views, ${performance.saves.toLocaleString()} saves, and ${performance.bookings.toLocaleString()} bookings`;
}

function laterDate(postDate: string, today: string, days: number): string {
  return addDaysToDate(postDate > today ? postDate : today, days);
}

export function buildActionInsight(
  action: InsightAction,
  post: InsightPost,
  posts: InsightPost[],
  today = post.date,
): ActionInsight {
  const eligiblePosts = posts.filter((item) => item.status !== 'skipped');
  const measured = eligiblePosts.filter((item) =>
    item.businessId === post.businessId
    && item.project === post.project
    && completeResults(item.performance)
  );
  const count = measured.length;
  const sample = `In the numbers you've uploaded, ${count} ${post.project} ${count === 1 ? 'post has' : 'posts have'} complete results.`;

  if (action === 'skipped') {
    const alreadyRescheduled = posts.some((item) => item.sourcePostId === post.id && item.suggestionKind === 'reschedule');
    return {
      action,
      title: 'A skipped post is not a result',
      evidence: `${sample} You marked “${post.title}” as skipped.`,
      recommendation: completeResults(post.performance)
        ? 'This post has saved results too. Check whether it ran before rescheduling; skipping did not erase those numbers.'
        : 'A missed date tells us nothing about the idea’s performance. If it is still useful, try a new date rather than calling it a failed post.',
      ...(!completeResults(post.performance) && !alreadyRescheduled ? {
        proposal: {
          kind: 'reschedule' as const,
          triggerPostId: post.id,
          sourcePostId: post.id,
          contentType: post.contentType,
          title: `${post.project}: revisit ${post.title}`,
          date: laterDate(post.date, today, 2),
        },
      } : {}),
    };
  }

  if (action === 'completed' && !completeResults(post.performance)) {
    return {
      action,
      title: 'Published, but not measured yet',
      evidence: `${sample} “${post.title}” does not yet have views, saves, and bookings all recorded.`,
      recommendation: 'Add the missing results before drawing a conclusion or scheduling a performance-based follow-up.',
    };
  }

  if (action === 'results' && !completeResults(post.performance)) {
    return {
      action,
      title: 'Results are still incomplete',
      evidence: `${sample} “${post.title}” does not yet have views, saves, and bookings all recorded.`,
      recommendation: 'Add the missing results before drawing a conclusion or scheduling a performance-based follow-up.',
    };
  }

  if (count < 3) {
    return {
      action,
      title: action === 'logged' ? 'A new post, not a pattern yet' : 'A result, not a trend yet',
      evidence: action === 'logged'
        ? `${sample} “${post.title}” is planned, but it has no results yet.`
        : `In the numbers you've uploaded, “${post.title}” has ${resultSummary(post.performance as Required<PostPerformance>)}. ${count} ${post.project} ${count === 1 ? 'post has' : 'posts have'} complete results.`,
      recommendation: 'Log views, saves, and bookings for at least 3 posts in this service before using the numbers to recommend another post.',
    };
  }

  // One recommendation per action: the established conversion-gap rule takes
  // priority, then overperformance, then a clearly labelled experiment.
  const plan = getConversionSuggestionPlans(eligiblePosts).find((candidate) => {
    const trigger = eligiblePosts.find((item) => item.id === candidate.triggerPostId);
    return trigger?.businessId === post.businessId && trigger.project === post.project;
  });
  if (plan) {
    const trigger = eligiblePosts.find((item) => item.id === plan.triggerPostId)!;
    const numbers = resultSummary(trigger.performance as Required<PostPerformance>);
    return {
      action,
      title: plan.kind === 'trust' ? 'Interest is there. Build trust next.' : 'Still interested. Make booking easier.',
      evidence: `In the numbers you've uploaded, “${trigger.title}” has ${numbers}. Bookings are below 20% of both views and saves, with ${count} measured ${post.project} posts to check against.`,
      recommendation: plan.kind === 'trust'
        ? 'The views and saves show interest, but bookings lag. A real client testimonial can address uncertainty before making an offer.'
        : 'The testimonial drew engagement but bookings still lag. A clear referral offer gives interested people a lower-friction way to book.',
      proposal: {
        kind: plan.kind,
        triggerPostId: plan.triggerPostId,
        sourcePostId: plan.sourcePostId,
        contentType: plan.kind === 'trust' ? 'Proof' : 'Book now',
        title: plan.title,
        date: laterDate(trigger.date, today, 2),
      },
    };
  }

  if (action === 'logged') {
    const top = measured.reduce((best, item) =>
      item.performance!.views! > best.performance!.views! ? item : best
    );
    const alreadySuggested = posts.some((item) => item.sourcePostId === post.id && item.suggestionKind === 'insight');
    return {
      action,
      title: 'A real example to try',
      evidence: `${sample} The most-viewed of those posts is “${top.title}” with ${top.performance!.views!.toLocaleString()} views.`,
      recommendation: `Try a ${top.contentType.toLowerCase()} angle for ${post.project} as an experiment—not a guaranteed pattern from one successful post.`,
      ...(!alreadySuggested ? {
        proposal: {
          kind: 'insight' as const,
          triggerPostId: post.id,
          sourcePostId: post.id,
          contentType: top.contentType,
          title: `${post.project}: test another ${top.contentType.toLowerCase()} angle`,
          date: laterDate(post.date, today, 3),
        },
      } : {}),
    };
  }

  const numbers = resultSummary(post.performance as Required<PostPerformance>);
  const gap = getConversionGap(post, eligiblePosts);
  if (gap) {
    return {
      action,
      title: 'The trust step is already on the calendar',
      evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}; bookings are below 20% of both views and saves.`,
      recommendation: 'Measure the existing testimonial before choosing another offer. No duplicate suggestion is needed.',
    };
  }

  const overperformer = getOverperformer(post, eligiblePosts);
  if (overperformer && !posts.some((item) => item.sourcePostId === post.id && item.suggestionKind === 'overperformer')) {
    return {
      action,
      title: 'An angle worth testing again',
      evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}. Its ${overperformer.views.toLocaleString()} views are at least twice the ${Math.round(overperformer.averageViews).toLocaleString()}-view average across ${overperformer.postCount} ${post.project} posts.`,
      recommendation: 'A similar follow-up is worth testing because this post stood out against the other measured posts—not because one result guarantees a repeat.',
      proposal: {
        kind: 'overperformer',
        triggerPostId: post.id,
        sourcePostId: post.id,
        contentType: post.contentType,
        title: `More like: ${post.title}`,
        date: laterDate(post.date, today, 3),
      },
    };
  }

  return {
    action,
    title: 'Keep the next result in view',
    evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}; ${count} ${post.project} posts have complete results.`,
    recommendation: 'There is no clear new performance signal to act on here. Log the next result before changing your calendar.',
  };
}