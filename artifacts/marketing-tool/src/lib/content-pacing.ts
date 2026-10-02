import { addDaysToDate } from './follow-ups.ts';
import type { ServiceDefinition } from './services.ts';
import type { InsightPost } from './action-insight.ts';

export type CampaignPhase = 'upcoming' | 'early' | 'middle' | 'closing' | 'closed';
export const PACING_DAYS = { service: 7, overperformer: 5, early: 7, middle: 4, closing: 2, floor: 30 };
const dayNumber = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86400000;

export function getCampaignPhase(service: Extract<ServiceDefinition, { mode: 'campaign' }>, date: string): CampaignPhase {
  if (date < service.startDate) return 'upcoming';
  if (date > service.endDate) return 'closed';
  if (date >= addDaysToDate(service.endDate, -14)) return 'closing';
  return dayNumber(date) - dayNumber(service.startDate)
    < (dayNumber(service.endDate) - dayNumber(service.startDate)) / 2 ? 'early' : 'middle';
}

export function getClosingCampaigns(services: ServiceDefinition[], businessId: string, date: string) {
  return services.filter((service): service is Extract<ServiceDefinition, { mode: 'campaign' }> =>
    service.businessId === businessId && service.mode === 'campaign' && getCampaignPhase(service, date) === 'closing');
}

export function describeContentPacing(service: ServiceDefinition, services: ServiceDefinition[], date: string): string {
  if (service.mode === 'evergreen') {
    return getClosingCampaigns(services, service.businessId, date).length
      ? 'Service · light monthly presence while the Campaign closes; normal rhythm returns after the close.'
      : 'Service · varied weekly rhythm, adjusted by recorded results; a monthly minimum is always retained.';
  }
  const phase = getCampaignPhase(service, date);
  const descriptions: Record<CampaignPhase, string> = {
    upcoming: `Campaign · starts ${service.startDate}; awareness first, then proof and the booking close.`,
    early: `Campaign · awareness and interest, about weekly; deadline ${service.endDate}.`,
    middle: `Campaign · proof and momentum, about every four days; deadline ${service.endDate}.`,
    closing: `Campaign · pricing, urgency and bookings, about every two days through ${service.endDate}.`,
    closed: `Campaign · closed on ${service.endDate}; no new suggestions.`,
  };
  return descriptions[phase];
}

function closingFloor(
  service: ServiceDefinition, services: ServiceDefinition[], posts: InsightPost[], date: string,
) {
  const closing = getClosingCampaigns(services, service.businessId, date);
  if (!closing.length) return undefined;
  const start = closing.map((campaign) => {
    const finalStart = addDaysToDate(campaign.endDate, -14);
    return finalStart > campaign.startDate ? finalStart : campaign.startDate;
  }).sort()[0];
  const end = closing.map((campaign) => campaign.endDate).sort().at(-1)!;
  const presence = posts.filter((post) => post.businessId === service.businessId && post.project === service.name
    && post.status !== 'skipped' && post.date >= start && post.date <= end)
    .reduce((latest, post) => post.date > latest ? post.date : latest, '');
  const due = presence ? addDaysToDate(presence, PACING_DAYS.floor) : undefined;
  const resume = addDaysToDate(end, 1);
  return { end, presence, defer: due && due > date ? (due < resume ? due : resume) : undefined };
}

/** Shared by ordinary suggestions, the flat ladder, and trust/offer interventions.
 * Temporary Campaign priority is evaluated for the proposed day, never stored as
 * a permanent Service penalty. Already-approved calendar posts are not changed.
 */
export function getPacedSuggestionDate(
  service: ServiceDefinition,
  services: ServiceDefinition[],
  posts: InsightPost[],
  today: string,
  intendedDate: string,
  occupiedDates: string[] = [],
): string | undefined {
  if (service.mode === 'campaign' && today > service.endDate) return undefined;
  let intended = intendedDate < today ? today : intendedDate;
  if (service.mode === 'campaign') {
    if (intended < service.startDate) intended = service.startDate;
    if (intended > service.endDate) intended = service.endDate;
  } else {
    // A monthly floor must not make a Service absent from the entire peak.
    // If this closing window has no actual or approved Service presence, give
    // it one light slot even when its ordinary monthly date is further away.
    const floor = closingFloor(service, services, posts, today);
    if (floor && !floor.presence && intended > floor.end) {
      const nearDate = addDaysToDate(today, 2);
      intended = nearDate < floor.end ? nearDate : floor.end;
    }
  }
  const occupied = new Set([
    ...occupiedDates,
    ...posts.filter((post) => post.businessId === service.businessId && post.status !== 'skipped').map((post) => post.date),
  ]);
  // Keep searching through overlapping closing windows, but never silently
  // squeeze extra Service posts into a window whose monthly floor is covered.
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (service.mode === 'campaign' && intended > service.endDate) return undefined;
    if (service.mode === 'evergreen') {
      const defer = closingFloor(service, services, posts, intended)?.defer;
      if (defer) {
        intended = defer;
        continue;
      }
    }
    for (let nudge = 0; nudge <= 7; nudge += 1) {
      const date = addDaysToDate(intended, nudge);
      if (service.mode === 'campaign' && date > service.endDate) return undefined;
      // A collision nudge may enter a closing window, so re-check its floor.
      const defer = service.mode === 'evergreen' ? closingFloor(service, services, posts, date)?.defer : undefined;
      if (defer) {
        intended = defer;
        break;
      }
      if (!occupied.has(date)) return date;
      if (nudge === 7) return undefined;
    }
  }
  throw new Error('The overlapping Campaign windows could not be paced safely.');
}