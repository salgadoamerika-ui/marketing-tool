import type { ActionInsight, InsightPost, InsightProposal, InsightSequenceBeat } from './action-insight.ts';
import { addDaysToDate } from './follow-ups.ts';
import { getFlatPostState, getMaintenanceSuggestionDate } from './flat-post-ladder.ts';
import { getOverperformer } from './overperformer.ts';
import { getCampaignPhase, getClosingCampaigns, getPacedSuggestionDate, PACING_DAYS } from './content-pacing.ts';
import type { ServiceDefinition } from './services.ts';
import { buildPostRationale } from './post-rationale.ts';

const serviceRotation = ['Insight', 'Book now', 'Testimonial', 'Inside look', 'Proof', 'Recap'];
const campaignRotation = {
  early: ['Announcement', 'Inside look', 'Insight'],
  middle: ['Testimonial', 'Proof', 'Inside look'],
  closing: ['Pricing', 'Book now', 'Last chance'],
};
const labels: Record<string, string> = {
  Insight: 'share a useful tip', 'Inside look': 'show the experience',
  Announcement: 'introduce what is coming', Testimonial: 'share a real client story',
  Proof: 'share evidence of the experience', Recap: 'keep the service visible',
  Pricing: 'explain the pricing and how to book', 'Book now': 'invite the next booking',
  'Last chance': 'a final invitation before the deadline',
};

function nextType(rotation: string[], previous: string): string {
  const index = rotation.lastIndexOf(previous);
  return rotation[(index + 1) % rotation.length];
}

export function applyModeSuggestions(
  base: ActionInsight, post: InsightPost, posts: InsightPost[], today: string,
  occupiedDates: string[], services: ServiceDefinition[],
): ActionInsight {
  const service = services.find((item) => item.businessId === post.businessId && item.name === post.project);
  if (!service) throw new Error('Choose a saved Service or Campaign before planning content.');
  const closed = service.mode === 'campaign' && today > service.endDate;
  if (closed || (service.mode === 'campaign' && post.date > service.endDate)) return {
    ...base, title: 'This Campaign is complete',
    recommendation: `The Campaign deadline was ${service.endDate}. No new posts will be suggested. Already-approved posts stay on your calendar.`,
    beats: [], proposals: [],
  };
  const quiet = service.mode === 'evergreen' && getClosingCampaigns(services, service.businessId, today).length > 0;
  const special = post.status === 'skipped'
    || (service.mode === 'evergreen' && getFlatPostState(post, posts, today).action !== 'none');
  if (special) {
    const reserved = [...occupiedDates];
    const working = [...posts];
    const beats = base.beats.slice(0, quiet ? 1 : undefined).map((beat): InsightSequenceBeat => {
      if (beat.state !== 'suggested' || !beat.proposal) return beat;
      const date = getPacedSuggestionDate(service, services, working, today, beat.date, reserved);
      if (!date) return { ...beat, state: 'blocked', proposal: undefined };
      reserved.push(date);
      working.push({ ...post, ...beat.proposal, id: `proposed-${date}`, date });
      return { ...beat, date, proposal: { ...beat.proposal, date } };
    });
    return {
      ...base, beats, proposals: beats.flatMap((beat) => beat.proposal ? [beat.proposal] : []),
      recommendation: beats[0]
        ? buildPostRationale(
          posts.find((item) => item.id === beats[0].existingPostId)
            ?? { ...post, ...beats[0], performance: undefined, sourcePostId: beats[0].proposal?.sourcePostId ?? post.id },
          posts, today, services)
        : 'There is no available date for this follow-up. Existing posts have not been changed.',
    };
  }
  const comparable = posts.filter((item) => item.businessId === post.businessId && item.project === post.project
    && item.status !== 'skipped' && item.date <= today);
  const winner = service.mode === 'evergreen' && post.date <= today && getOverperformer(post, comparable);
  const beats: InsightSequenceBeat[] = [];
  const working = [...posts];
  const reserved = [...occupiedDates];
  let cursor = post.date > today ? post.date : today;
  let previous = working.filter((item) => item.businessId === service.businessId && item.project === service.name
    && item.status !== 'skipped' && item.date <= cursor)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).at(-1)?.contentType ?? post.contentType;
  if (previous === 'Announcement' && service.mode === 'evergreen') previous = 'Testimonial';

  const closingPreview = service.mode === 'campaign' && getCampaignPhase(service, cursor) === 'closing';
  for (let index = 0; index < (quiet ? 1 : closingPreview ? 3 : 2); index += 1) {
    if (service.mode === 'campaign' && cursor > service.endDate) break;
    const phase = service.mode === 'campaign' ? getCampaignPhase(service, cursor) : undefined;
    const interval = service.mode === 'campaign'
      ? phase === 'middle' ? PACING_DAYS.middle : phase === 'closing' ? PACING_DAYS.closing : PACING_DAYS.early
      : winner ? PACING_DAYS.overperformer : PACING_DAYS.service;
    let intendedDate = addDaysToDate(cursor, interval);
    if (quiet && index === 0) {
      const monthlyDate = getMaintenanceSuggestionDate(post, working, today);
      if (monthlyDate < intendedDate) intendedDate = monthlyDate;
    }
    if (service.mode === 'campaign') {
      const closingStart = addDaysToDate(service.endDate, -14);
      if (cursor < closingStart && intendedDate > closingStart) intendedDate = closingStart;
    }
    const date = getPacedSuggestionDate(service, services, working, today, intendedDate, reserved);
    if (!date) break;
    const postingPhase = service.mode === 'campaign' ? getCampaignPhase(service, date) : undefined;
    const floor = service.mode === 'evergreen' && getClosingCampaigns(services, service.businessId, date).length > 0;
    const contentType = postingPhase
      ? nextType(campaignRotation[postingPhase === 'upcoming' || postingPhase === 'closed' ? 'early' : postingPhase], previous)
      : floor ? 'Insight' : winner && index === 0 ? 'Fresh angle' : nextType(serviceRotation, previous);
    const existing = working.filter((item) => item.businessId === service.businessId && item.project === service.name
      && item.status !== 'skipped' && item.date > cursor && item.date <= date
      && item.contentType === contentType
      && (service.mode !== 'campaign' || getCampaignPhase(service, item.date) === postingPhase))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
    if (existing) {
      beats.push({ state: 'scheduled', contentType: existing.contentType, title: existing.title,
        date: existing.date, existingPostId: existing.id });
      cursor = existing.date;
      previous = existing.contentType;
      continue;
    }
    const title = `${service.name}: ${winner && index === 0 && !floor ? `build on “${post.title}” with a new angle`
      : floor ? 'a useful check-in' : labels[contentType] ?? 'keep the conversation useful'}`
      + (service.mode === 'campaign' && postingPhase === 'closing' ? ` · closes ${service.endDate}` : '');
    const proposal: InsightProposal = { kind: floor ? 'maintenance' : 'automatic',
      triggerPostId: post.id, sourcePostId: post.id, contentType, title, date };
    // Only revise this source's unposted, generated suggestions. Manual posts,
    // recorded results and other sources' plans are not ours to rewrite.
    const outdated = working.filter((item) => item.businessId === service.businessId && item.project === service.name
      && item.sourcePostId === post.id && item.schedulingStatus === 'approved-suggestion'
      && item.status !== 'skipped' && item.performance === undefined && item.date > cursor && item.date > today
      && (item.contentType !== contentType
        || (service.mode === 'campaign' && getCampaignPhase(service, item.date) !== postingPhase))
      && !(quiet && getClosingCampaigns(services, service.businessId, item.date).length))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
    if (outdated) proposal.replaces = {
      postId: outdated.id, title: outdated.title, contentType: outdated.contentType, date: outdated.date,
    };
    beats.push({ state: 'suggested', contentType, title, date, proposal });
    reserved.push(date);
    const planned = { ...post, ...proposal, id: outdated?.id ?? `proposed-${index}-${date}`, performance: undefined };
    if (outdated) working.splice(working.findIndex((item) => item.id === outdated.id), 1, planned);
    else working.push(planned);
    cursor = date;
    previous = contentType;
  }
  // The existing flat ladder owns permanent monthly maintenance. This branch
  // only supplies ordinary rotations or temporary Campaign-priority pacing.
  const proposals = beats.flatMap((beat) => beat.proposal ? [beat.proposal] : []);
  const next = beats.find((beat) => beat.state === 'suggested') ?? beats[0];
  const subject = next?.existingPostId ? working.find((item) => item.id === next.existingPostId)
    : next ? { ...post, ...next, performance: undefined, sourcePostId: post.id } : undefined;
  const explanation = subject ? buildPostRationale(subject, working, today, services)
    : 'There is no open date for the next step within the allowed booking window.';
  return { ...base,
    title: service.mode === 'campaign' ? 'Build toward the Campaign deadline' : 'Keep the conversation useful',
    recommendation: `${explanation} ${proposals.length ? 'Nothing changes until you approve.' : beats.length ? 'The posts shown below are already on your calendar; nothing new will be added.' : 'Nothing new will be added.'}`,
    beats, proposals };
}