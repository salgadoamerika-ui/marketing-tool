import type { ServiceDefinition } from '@/lib/services';

export type CampaignWakeCycle = {
  cycleKey: string;
  startDate: string;
  endDate: string;
};

type CampaignPostLearning = {
  id: string;
  businessId: string;
  project: string;
  date: string;
  status?: 'completed' | 'skipped';
  performance?: { views?: number; saves?: number; bookings?: number };
};

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateInYear(value: string, year: number) {
  const { month, day } = dateParts(value);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return dateString(new Date(Date.UTC(year, month - 1, Math.min(day, lastDayOfMonth))));
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateString(date);
}

function dayDifference(start: string, end: string) {
  return Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000);
}

export function campaignCycleForYear(
  campaign: Extract<ServiceDefinition, { mode: 'campaign' }>,
  year: number,
): CampaignWakeCycle {
  const startDate = dateInYear(campaign.startDate, year);
  const endDate = addDays(startDate, dayDifference(campaign.startDate, campaign.endDate));
  return { cycleKey: `${campaign.id}:${startDate}`, startDate, endDate };
}

export function nextCampaignWakeCycle(
  campaign: Extract<ServiceDefinition, { mode: 'campaign' }>,
  today: string,
): CampaignWakeCycle | null {
  if (campaign.status !== 'dormant') return null;
  const dormantSince = campaign.dormantSince ?? campaign.endDate;
  const afterYear = dateParts(dormantSince).year;
  const todayYear = dateParts(today).year;
  for (let year = Math.min(afterYear, todayYear); year <= Math.max(afterYear, todayYear) + 3; year += 1) {
    const cycle = campaignCycleForYear(campaign, year);
    if (cycle.startDate <= dormantSince || cycle.endDate < today) continue;
    return cycle;
  }
  return null;
}

export function isCampaignWakeCycleOpen(
  campaign: Extract<ServiceDefinition, { mode: 'campaign' }>,
  cycle: CampaignWakeCycle,
  today: string,
) {
  return campaign.status === 'dormant'
    && today >= cycle.startDate
    && today <= cycle.endDate
    && !(campaign.wakeUpHandledCycles ?? []).includes(cycle.cycleKey);
}

export function findDormantCampaignMatch(name: string, services: ServiceDefinition[], businessId: string) {
  const normalize = (value: string) => value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const target = normalize(name);
  if (target.length < 3) return undefined;
  return services
    .filter((service): service is Extract<ServiceDefinition, { mode: 'campaign' }> =>
      service.businessId === businessId && service.mode === 'campaign' && service.status === 'dormant'
      && normalize(service.name) === target)
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
}

export function cycleForCampaignName(
  campaign: Extract<ServiceDefinition, { mode: 'campaign' }>,
  name: string,
  today: string,
): CampaignWakeCycle | null {
  const match = name.match(/\b((?:19|20)\d{2})\b/);
  const nameYear = match ? Number(match[1]) : undefined;
  const originalYear = dateParts(campaign.startDate).year;
  if (nameYear && nameYear > originalYear) return campaignCycleForYear(campaign, nameYear);
  return nextCampaignWakeCycle(campaign, today);
}

export function campaignNameForCycle(name: string, cycle: CampaignWakeCycle) {
  const year = cycle.startDate.slice(0, 4);
  return /\b(?:19|20)\d{2}\b/.test(name)
    ? name.replace(/\b(?:19|20)\d{2}\b/, year)
    : name;
}

export function bestCampaignLearningPost<T extends CampaignPostLearning>(
  campaign: Extract<ServiceDefinition, { mode: 'campaign' }>,
  posts: T[],
): T | undefined {
  const campaignPosts = posts.filter((post) => post.businessId === campaign.businessId
    && post.project === campaign.name && post.status !== 'skipped');
  const measured = campaignPosts.filter((post) => post.performance
    && [post.performance.views, post.performance.saves, post.performance.bookings]
      .some((value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0));
  const ranked = (items: T[]) => [...items].sort((left, right) =>
    (right.performance?.bookings ?? -1) - (left.performance?.bookings ?? -1)
    || (right.performance?.views ?? -1) - (left.performance?.views ?? -1)
    || (right.performance?.saves ?? -1) - (left.performance?.saves ?? -1)
    || right.date.localeCompare(left.date));
  return ranked(measured)[0] ?? [...campaignPosts].sort((left, right) => right.date.localeCompare(left.date))[0];
}

export function handledWakeCycle(campaign: Extract<ServiceDefinition, { mode: 'campaign' }>, cycleKey: string) {
  return [...new Set([...(campaign.wakeUpHandledCycles ?? []), cycleKey])];
}
