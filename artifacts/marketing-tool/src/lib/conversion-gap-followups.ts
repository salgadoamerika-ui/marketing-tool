import { assessConversionGap, getMeasuredServicePosts, hasCompletePerformance, type ConversionPost } from './conversion-gap.ts';
import { addDaysToDate } from './follow-ups.ts';

export type ConversionSuggestionPlan = {
  kind: 'trust' | 'offer';
  triggerPostId: string;
  sourcePostId: string;
  date: string;
  title: string;
};

export type ConversionSequence = {
  stage: 'trust' | 'waiting-trust' | 'offer' | 'waiting-offer';
  plan?: ConversionSuggestionPlan;
};

export function getConversionSequence(service: ConversionPost, posts: ConversionPost[], today: string): ConversionSequence | undefined {
  const assessment = assessConversionGap(service, posts);
  if (assessment.status !== 'detected') return undefined;
  const comparable = posts.filter((post) => post.businessId === service.businessId
    && post.project === service.project && post.status !== 'skipped');
  const measured = getMeasuredServicePosts(service, posts);
  const episodeIndex = measured.findIndex((post) => post.id === assessment.episodePostId);
  // Older approvals linked to the first weak post, rather than the third
  // measured post. Honor those within the initial episode, never after recovery.
  const currentSources = new Set(measured.slice(episodeIndex === 2 ? 0 : episodeIndex).map((post) => post.id));
  const trust = comparable.find((post) => post.suggestionKind === 'trust'
    && post.sourcePostId !== undefined && currentSources.has(post.sourcePostId));
  const latest = measured[measured.length - 1];
  if (!trust) return {
    stage: 'trust',
    plan: {
      kind: 'trust', triggerPostId: latest.id, sourcePostId: latest.id,
      date: addDaysToDate(latest.date, 2), title: `${service.project}: a client testimonial`,
    },
  };
  if (!hasCompletePerformance(trust.performance) || trust.date > today) return { stage: 'waiting-trust' };
  const offer = comparable.find((post) => post.suggestionKind === 'offer' && post.sourcePostId === trust.sourcePostId);
  if (offer) return { stage: 'waiting-offer' };
  return {
    stage: 'offer',
    plan: {
      kind: 'offer', triggerPostId: latest.id, sourcePostId: trust.sourcePostId!,
      date: addDaysToDate(latest.date, 2), title: `${service.project}: referral offer to book`,
    },
  };
}

export function getConversionSuggestionPlans(posts: ConversionPost[], today: string): ConversionSuggestionPlan[] {
  const services = new Map<string, ConversionPost>();
  for (const post of posts) services.set(JSON.stringify([post.businessId, post.project]), post);
  return [...services.values()].flatMap((service) => {
    const sequence = getConversionSequence(service, posts, today);
    return sequence?.plan ? [sequence.plan] : [];
  });
}