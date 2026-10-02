import { AIRTIME_RULES, getAirtimeAllocations, type AirtimePost } from './airtime-allocation.ts';

export type MonthlyAirtimeRow = {
  service: string;
  postCount: number;
  sharePercent: number;
  tag: 'Peak' | 'Riding' | 'Steady' | 'Floor';
  boosted: boolean;
  maintenance: boolean;
};

export const MONTHLY_AIRTIME_RULES = {
  floorPercent: 8,
  performanceMultiplier: 1.5,
} as const;

/**
 * Calendar airtime, not the separate recommended weekly allocation.
 * Reserve a visible floor, then distribute the remainder by monthly volume.
 */
export function getMonthlyAirtime(
  businessId: string,
  services: string[],
  posts: AirtimePost[],
  year: number,
  month: number,
): MonthlyAirtimeRow[] {
  // Reuse the established three-result gate and performance signals, but not
  // season bonuses: these bars describe the selected calendar's actual mix.
  const signals = getAirtimeAllocations(
    businessId, services.map((name) => ({ name, seasonMonths: [] })), posts, year, month,
  ).allocations;
  if (!services.length) return [];
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const monthEnd = `${prefix}${new Date(year, month, 0).getDate()}`;
  const monthlyPosts = posts.filter((post) =>
    post.businessId === businessId && post.status !== 'skipped'
    && /^\d{4}-\d{2}-\d{2}$/.test(post.date)
    && post.date.startsWith(prefix) && post.date <= monthEnd
    && Number(post.date.slice(-2)) >= 1
  );
  const scored = signals.map((signal) => {
    const postCount = monthlyPosts.filter((post) => post.project === signal.service).length;
    const maintenance = signal.status === 'maintenance';
    const boosted = signal.signal === 'above-average'
      && signal.measuredPostCount >= AIRTIME_RULES.minimumMeasuredPosts;
    const atFloor = postCount <= 1 || maintenance;
    return {
      service: signal.service,
      postCount,
      boosted,
      maintenance,
      atFloor,
      weight: atFloor ? 0 : postCount * (boosted ? MONTHLY_AIRTIME_RULES.performanceMultiplier : 1),
    };
  });
  const floor = Math.min(MONTHLY_AIRTIME_RULES.floorPercent, 100 / services.length);
  const remaining = 100 - floor * services.length;
  const totalWeight = scored.reduce((sum, row) => sum + row.weight, 0);
  const shares = scored.map((row) => ({
    ...row,
    sharePercent: totalWeight > 0
      ? floor + remaining * row.weight / totalWeight
      : 100 / services.length,
  }));
  // Stable service order breaks ties; no Peak is invented for an empty month.
  const peak = shares.reduce<null | (typeof shares)[number]>((best, row) =>
    row.atFloor ? best : !best || row.sharePercent > best.sharePercent ? row : best, null);
  return shares.map((row) => ({
    service: row.service,
    postCount: row.postCount,
    sharePercent: row.sharePercent,
    boosted: row.boosted,
    maintenance: row.maintenance,
    tag: row.atFloor ? 'Floor'
      : row === peak ? 'Peak'
        : row.boosted ? 'Riding' : 'Steady',
  }));
}