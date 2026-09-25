import type { PostPerformance } from '@/components/post-performance-form';
import { getConversionGap } from './conversion-gap.ts';
import { getOverperformer } from './overperformer.ts';

export type InsightAction = 'logged' | 'results' | 'completed' | 'skipped';

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

export type ActionInsight = {
  action: InsightAction;
  title: string;
  evidence: string;
  recommendation: string;
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

export function buildActionInsight(
  action: InsightAction,
  post: InsightPost,
  posts: InsightPost[],
): ActionInsight {
  const measured = posts.filter((item) =>
    item.businessId === post.businessId
    && item.project === post.project
    && item.status !== 'skipped'
    && completeResults(item.performance)
  );
  const count = measured.length;
  const sample = `In the numbers you've uploaded, ${count} ${post.project} ${count === 1 ? 'post has' : 'posts have'} complete results.`;

  if (action === 'skipped') {
    return {
      action,
      title: 'A skipped post is not a result',
      evidence: `${sample} You marked “${post.title}” as skipped.`,
      recommendation: completeResults(post.performance)
        ? 'This post also has results saved. Check whether it ran before treating the date as a missed slot; those results were not deleted.'
        : 'If this idea still matters, move it to a new date. Do not count an unpublished post as underperforming.',
    };
  }

  if (action === 'logged') {
    if (count < 3) {
      return {
        action,
        title: 'A new post, not a pattern yet',
        evidence: `${sample} “${post.title}” is planned, but it has no results yet.`,
        recommendation: 'After publishing, log views, saves, and bookings. At least 3 measured posts in this service are needed before comparing performance.',
      };
    }
    const top = measured.reduce((best, item) =>
      item.performance!.views! > best.performance!.views! ? item : best
    );
    return {
      action,
      title: 'A real example to plan from',
      evidence: `${sample} The most-viewed of those posts is “${top.title}” with ${top.performance!.views!.toLocaleString()} views.`,
      recommendation: `For “${post.title}”, try an angle inspired by that ${top.contentType.toLowerCase()} post as an experiment—not a guaranteed result.`,
    };
  }

  if (!completeResults(post.performance)) {
    return {
      action,
      title: action === 'completed' ? 'Published, but not measured yet' : 'Results are still incomplete',
      evidence: `${sample} “${post.title}” does not yet have views, saves, and bookings all recorded.`,
      recommendation: 'Add the missing results before drawing a conclusion about this post.',
    };
  }

  const numbers = resultSummary(post.performance);
  if (count < 3) {
    return {
      action,
      title: 'A result, not a trend yet',
      evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}. ${count} ${post.project} ${count === 1 ? 'post has' : 'posts have'} complete results.`,
      recommendation: 'Record results for at least 3 posts in this service before acting on a performance pattern.',
    };
  }

  const gap = getConversionGap(post, posts);
  if (gap) {
    const nextKind = post.suggestionKind === 'trust' ? 'offer' : 'trust';
    const scheduled = nextKind === 'trust'
      ? posts.some((item) => item.businessId === post.businessId && item.project === post.project && item.suggestionKind === 'trust')
      : posts.some((item) => item.sourcePostId === post.sourcePostId && item.suggestionKind === 'offer');
    return {
      action,
      title: nextKind === 'trust' ? 'Bookings are the missing step' : 'The testimonial still needs a next step',
      evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}. Bookings are below 20% of both views and saves across this post's results; ${count} ${post.project} posts have complete results.`,
      recommendation: scheduled
        ? `A suggested ${nextKind === 'trust' ? 'testimonial' : 'referral offer'} was added to the calendar. Review it before publishing.`
        : `Consider a ${nextKind === 'trust' ? 'client testimonial' : 'referral offer'} next; no suggestion is currently on the calendar.`,
    };
  }

  const overperformer = getOverperformer(post, posts);
  if (overperformer) {
    return {
      action,
      title: 'A post worth learning from',
      evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}. Its ${overperformer.views.toLocaleString()} views are at least twice the ${Math.round(overperformer.averageViews).toLocaleString()}-view average across ${overperformer.postCount} ${post.project} posts.`,
      recommendation: 'Try another post with a similar angle and compare the results before making it a repeatable format.',
    };
  }

  return {
    action,
    title: action === 'completed' ? 'A completed post with real results' : 'One measured post, in context',
    evidence: `In the numbers you've uploaded, “${post.title}” has ${numbers}; ${count} ${post.project} posts have complete results.`,
    recommendation: 'Keep measuring the next post before changing your plan. This result alone does not establish a trend.',
  };
}