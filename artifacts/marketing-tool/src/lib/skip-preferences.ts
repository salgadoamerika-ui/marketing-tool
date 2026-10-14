import type { ActionInsight, InsightPost } from './action-insight.ts';

const typeKey = (name: string) => name.trim().toLowerCase();

/** Preference feedback is not a performance claim, so a single skip counts.
 * Derive it from retained posts rather than keeping a second learning store. */
export function getSkipSuggestionWeight(post: InsightPost, posts: InsightPost[], contentType: string): number {
  const skips = posts.filter((item) => item.businessId === post.businessId
    && item.project === post.project && item.status === 'skipped'
    && typeKey(item.contentType) === typeKey(contentType)).length;
  return Math.max(0.35, Math.pow(0.8, skips));
}

export function shouldSuggestContentType(post: InsightPost, posts: InsightPost[], contentType: string): boolean {
  const weight = getSkipSuggestionWeight(post, posts, contentType);
  if (weight === 1) return true;
  // Stable per source/type: refreshes don't reshuffle suggestions, and more
  // skips lower frequency without banning the type or affecting other types.
  const key = `${post.businessId}|${post.project}|${post.id}|${typeKey(contentType)}`;
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296 < weight;
}

export function applySkipPreferences(insight: ActionInsight, post: InsightPost, posts: InsightPost[]): ActionInsight {
  if (insight.action === 'skipped') return insight;
  const beats = insight.beats.filter((beat) => !beat.proposal
    || shouldSuggestContentType(post, posts, beat.contentType));
  if (beats.length === insight.beats.length) return insight;
  const proposals = beats.flatMap((beat) => beat.proposal ? [beat.proposal] : []);
  return {
    ...insight,
    beats,
    proposals,
    title: proposals.length ? 'Next moves for this service' : 'Your preferences are noted',
    recommendation: proposals.length
      ? 'A lighter mix for this service, reflecting the types you have skipped. Nothing changes until you approve.'
      : 'No new move to add right now. Skipped posts stay in your record; other content types are still available.',
  };
}
