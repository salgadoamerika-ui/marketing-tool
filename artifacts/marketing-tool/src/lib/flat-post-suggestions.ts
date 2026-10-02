import type { ActionInsight, InsightAction, InsightPost, InsightProposal, InsightSequenceBeat } from './action-insight';
import { getFlatPostState, getMaintenanceSuggestionDate } from './flat-post-ladder.ts';
import { addDaysToDate } from './follow-ups.ts';

export function buildFlatPostInsight(
  action: InsightAction,
  service: InsightPost,
  posts: InsightPost[],
  today: string,
  occupiedDates: string[],
): ActionInsight | undefined {
  const state = getFlatPostState(service, posts, today);
  if (state.action === 'none') return undefined;
  const source = posts.find((post) => post.id === state.latestPostId)!;
  const kind = state.action;
  const comparable = posts.filter((post) =>
    post.businessId === service.businessId && post.project === service.project && post.status !== 'skipped'
  );
  const existing = comparable.filter((post) =>
    post.date > today && (kind === 'maintenance' ? post.date <= addDaysToDate(today, 30)
      : (post.sourcePostId === source.id && post.suggestionKind === kind))
  ).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];

  const title = kind === 'repost' ? 'This is worth another shot'
    : kind === 'fresh-angle' ? 'Same topic, fresh approach'
      : 'Keep a light, useful presence';
  const recommendation = kind === 'repost'
    ? 'Worth another shot — timing may have been off. Repost the same content before trying a brand-new move.'
    : kind === 'fresh-angle'
      ? 'Keep the topic, but change the opening or format. Try a fresh approach rather than moving to a new subject.'
      : 'Keep this service in the mix with a useful monthly check-in. Give your other services more room between posts.';
  const evidence = `“${source.title}” for ${source.project}.`;
  if (existing) return {
    action, title: 'Your next beat is already set', evidence,
    recommendation: `${recommendation} “${existing.title}” is already on the calendar; no extra post is needed.`,
    beats: [{
      state: 'scheduled', contentType: existing.contentType, title: existing.title,
      date: existing.date, existingPostId: existing.id,
    }],
    proposals: [],
  };

  const contentType = kind === 'repost' ? source.contentType : kind === 'fresh-angle' ? 'Fresh angle' : 'Insight';
  const postTitle = kind === 'repost' ? source.title
    : kind === 'fresh-angle' ? `${source.title} — a fresh approach` : `${source.project}: a useful monthly check-in`;
  const intendedDate = kind === 'maintenance'
    ? getMaintenanceSuggestionDate(service, posts, today)
    : addDaysToDate(source.date > today ? source.date : today, 2);
  const occupied = new Set([
    ...occupiedDates,
    ...posts.filter((post) => post.businessId === service.businessId && post.status !== 'skipped').map((post) => post.date),
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
  const proposal: InsightProposal = {
    kind, triggerPostId: source.id, sourcePostId: source.id, contentType, title: postTitle, date,
  };
  const beat: InsightSequenceBeat = {
    state: blocked ? 'blocked' : 'suggested', contentType, title: postTitle, date,
    ...(blocked ? {} : { proposal }),
  };
  return {
    action, title, evidence,
    recommendation: blocked ? `${recommendation} Free a calendar slot before adding this move.` : recommendation,
    beats: [beat], proposals: blocked ? [] : [proposal],
  };
}