import type { PostPerformance } from '@/components/post-performance-form';
import { getConversionGap } from './conversion-gap.ts';
import { addDaysToDate } from './follow-ups.ts';

type ConversionPost = {
  id: string;
  businessId: string;
  project: string;
  date: string;
  performance?: PostPerformance;
  suggestionKind?: string;
  sourcePostId?: string;
};

export type ConversionSuggestionPlan = {
  kind: 'trust' | 'offer';
  triggerPostId: string;
  sourcePostId: string;
  date: string;
  title: string;
};

function serviceKey(post: ConversionPost): string {
  return JSON.stringify([post.businessId, post.project]);
}

export function getConversionSuggestionPlans(posts: ConversionPost[]): ConversionSuggestionPlan[] {
  const trustServices = new Set(posts.filter((post) => post.suggestionKind === 'trust').map(serviceKey));
  const offerSources = new Set(
    posts.filter((post) => post.suggestionKind === 'offer').map((post) => post.sourcePostId),
  );
  const plans: ConversionSuggestionPlan[] = [];

  for (const post of [...posts].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (!getConversionGap(post, posts)) continue;

    if (post.suggestionKind === 'trust') {
      const sourcePostId = post.sourcePostId;
      if (!sourcePostId || !posts.some((source) => source.id === sourcePostId) || offerSources.has(sourcePostId)) continue;
      offerSources.add(sourcePostId);
      plans.push({
        kind: 'offer',
        triggerPostId: post.id,
        sourcePostId,
        date: addDaysToDate(post.date, 2),
        title: `${post.project}: referral offer to book`,
      });
    } else if (post.suggestionKind !== 'offer' && !trustServices.has(serviceKey(post))) {
      trustServices.add(serviceKey(post));
      plans.push({
        kind: 'trust',
        triggerPostId: post.id,
        sourcePostId: post.id,
        date: addDaysToDate(post.date, 2),
        title: `${post.project}: a client testimonial`,
      });
    }
  }

  return plans;
}