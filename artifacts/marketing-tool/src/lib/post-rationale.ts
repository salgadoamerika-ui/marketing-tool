import type { InsightPost } from './action-insight.ts';
import type { ServiceDefinition } from './services.ts';
import { getCampaignPhase, getClosingCampaigns } from './content-pacing.ts';
import { getOverperformer } from './overperformer.ts';
import { assessConversionGap } from './conversion-gap.ts';
import { getFlatPostState } from './flat-post-ladder.ts';

const purposes: Record<string, string> = {
  Announcement: 'People need to understand what is on offer and why it matters to them. A clear introduction gives later proof and booking posts something to build on.',
  Insight: 'Answer a useful question people have before they buy. Helping them understand the service gives them a reason to trust you when they are ready to book.',
  'Inside look': 'Show what the experience actually involves. Making the process easier to picture removes uncertainty before someone commits.',
  Testimonial: 'A real client story helps someone who is interested but still unsure. Use an actual experience to address hesitation rather than making another sales claim.',
  Proof: 'Show real evidence of what the service delivers. This helps people move from understanding the offer to feeling confident enough to choose it.',
  Pricing: 'People may be interested but still unsure what booking costs. Accurate pricing removes that uncertainty and makes the next step concrete.',
  'Book now': 'Give interested people a clear way to become paying clients. Explain how to book and what happens next instead of making them work it out.',
  'Last chance': 'Give people who are still deciding a clear reminder of the real deadline and how to act before it. Do not invent limited places or availability.',
  Recap: 'Bring the useful points together so someone who missed earlier posts can understand the offer. Give them a practical next step without repeating the same sales pitch.',
  Promo: 'Explain the real offer and who it is for. Make the benefit and terms clear so people can decide without relying on invented discounts or urgency.',
  'Fresh angle': 'Keep the topic, but try a different opening or format. This tests another way of making the message useful without repeating the same post.',
};

/** Translate the same lifecycle and gated evidence used by the planner into
 * a short explanation, without exposing cadence, counters or allocation rules. */
export function buildPostRationale(
  post: InsightPost, posts: InsightPost[], today: string, services: ServiceDefinition[],
): string {
  const offering = services.find((item) => item.businessId === post.businessId && item.name === post.project);
  let context = 'This move helps people understand the offer and take the next step toward becoming a client.';
  if (offering?.mode === 'campaign') {
    const phase = getCampaignPhase(offering, post.date);
    if (phase === 'closed') return today > offering.endDate
      ? 'The Campaign deadline has passed. This saved post is a record of what was planned, not a recommendation to add another Campaign post.'
      : 'This post is dated after the Campaign deadline. New Campaign suggestions need to stay within the actual booking window.';
    context = phase === 'closing'
      ? 'This post falls in the final two weeks of the Campaign, so it is time to turn interest into paid bookings rather than start another introduction.'
      : phase === 'middle'
        ? 'This is the part of the Campaign where people need reasons to believe the offer before deciding to pay.'
        : 'This is the introduction stage of the Campaign: help people understand the offer before asking them to commit.';
  } else if (offering && getClosingCampaigns(services, post.businessId, post.date).length) {
    context = 'A Campaign is approaching its deadline, but this Service should still be useful and visible alongside it.';
  } else if (offering) {
    context = 'This Service is an ongoing offer, so the aim is to build trust and give people useful reasons to return when they need it.';
  }
  const comparable = posts.filter((item) => item.businessId === post.businessId && item.project === post.project
    && item.status !== 'skipped' && item.date <= today);
  const source = post.sourcePostId ? comparable.find((item) => item.id === post.sourcePostId) : comparable.find((item) => item.id === post.id);
  const winner = source && getOverperformer(source, comparable);
  const gap = assessConversionGap(post, comparable);
  const flat = getFlatPostState(post, comparable, today);
  let evidence = '';
  if (winner) {
    evidence = 'The original post drew at least twice the usual views for this offering, so there is a real reason to build on that topic with a different treatment.';
  } else if (gap.status === 'detected') {
    evidence = post.suggestionKind === 'offer'
      ? 'Recent posts are being seen, but bookings have not kept up; after the trust-building step, make the decision and booking process easier.'
      : 'Recent posts are being seen, but bookings have not kept up, so helping people feel confident about the offer matters more than making louder claims.';
  } else if (flat.action !== 'none' && offering?.mode !== 'campaign') {
    evidence = 'Recent posts have received less attention than this Service usually gets, so focus on a useful message rather than repeating the same sales push.';
  }
  return [context, purposes[post.contentType] ?? 'Give people one clear, useful message and a practical way to follow up.', evidence]
    .filter(Boolean).join(' ');
}