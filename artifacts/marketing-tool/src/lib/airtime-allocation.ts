export type AirtimeService = {
  name: string;
  seasonMonths: number[];
};

export type AirtimePost = {
  id: string;
  businessId: string;
  project: string;
  date: string;
  status?: 'completed' | 'skipped';
  performance?: { views?: number };
};

export type AirtimeSignal = 'insufficient-data' | 'flat' | 'above-average' | 'consistently-weak';

export type ServiceAirtimeAllocation = {
  service: string;
  status: 'active' | 'maintenance';
  airtimeScore: number;
  postsPerWeek: number;
  sharePercent: number;
  inSeason: boolean;
  signal: AirtimeSignal;
  measuredPostCount: number;
  averageViews?: number;
  priorAverageViews?: number;
  recentViews?: number;
  tryNewAngle: boolean;
};

export type AirtimeAllocationResult = {
  allocations: ServiceAirtimeAllocation[];
  weeklyCapacity: number;
  monthlyFloor: number;
};

export const AIRTIME_RULES = {
  baseScore: 1,
  seasonBoost: 0.75,
  attentionBoost: 0.5,
  underperformancePenalty: 0.85,
  scoreFloor: 0.25,
  weeklyCapacity: 3,
  monthlyFloor: 1,
  minimumMeasuredPosts: 3,
} as const;

function isValidViewCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateThroughMonthEnd(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function getAirtimeAllocations(
  businessId: string,
  services: AirtimeService[],
  posts: AirtimePost[],
  year: number,
  month: number,
): AirtimeAllocationResult {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Airtime month must be an integer from 1 to 12.');
  }
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError('Airtime year must be a positive integer.');
  }

  const monthEnd = dateThroughMonthEnd(year, month);
  const weeklyFloor = AIRTIME_RULES.monthlyFloor / 4;
  const weeklyCapacity = Math.max(AIRTIME_RULES.weeklyCapacity, weeklyFloor * services.length);

  const scored = services.map((service) => {
    const inSeason = service.seasonMonths.includes(month);
    const measured = posts
      .filter((post) =>
        post.businessId === businessId
        && post.project === service.name
        && post.status !== 'skipped'
        && post.date <= monthEnd
        && /^\d{4}-\d{2}-\d{2}$/.test(post.date)
        && isValidViewCount(post.performance?.views)
      )
      .map((post) => ({
        date: post.date,
        id: post.id,
        views: post.performance!.views!,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    const measuredPostCount = measured.length;
    const averageViews = measuredPostCount ? average(measured.map((post) => post.views)) : undefined;
    const recentViews = measured.at(-1)?.views;
    const hasEnoughData = measuredPostCount >= AIRTIME_RULES.minimumMeasuredPosts;
    const earlierAverage = measured.length > 1
      ? average(measured.slice(0, -1).map((post) => post.views))
      : undefined;
    const recentThree = measured.slice(-AIRTIME_RULES.minimumMeasuredPosts);
    const consistentlyWeak = hasEnoughData
      && recentThree.every((post) => post.views < averageViews!);
    const aboveAverage = hasEnoughData
      && earlierAverage !== undefined
      && recentViews !== undefined
      && recentViews > earlierAverage;
    const signal: AirtimeSignal = !hasEnoughData
      ? 'insufficient-data'
      : aboveAverage ? 'above-average'
        : consistentlyWeak ? 'consistently-weak'
          : 'flat';

    const status = consistentlyWeak ? 'maintenance' : 'active';
    const tryNewAngle = inSeason && signal === 'flat';
    const rawScore = AIRTIME_RULES.baseScore
      + (inSeason ? AIRTIME_RULES.seasonBoost : 0)
      + (signal === 'above-average' ? AIRTIME_RULES.attentionBoost : 0)
      - (signal === 'consistently-weak' ? AIRTIME_RULES.underperformancePenalty : 0);

    return {
      service: service.name,
      status,
      airtimeScore: Math.max(rawScore, AIRTIME_RULES.scoreFloor),
      postsPerWeek: weeklyFloor,
      sharePercent: 0,
      inSeason,
      signal,
      measuredPostCount,
      averageViews,
      priorAverageViews: earlierAverage,
      recentViews,
      tryNewAngle,
    } satisfies ServiceAirtimeAllocation;
  });

  const remainingWeeklySlots = Math.max(0, weeklyCapacity - weeklyFloor * scored.length);
  const activeScoreTotal = scored
    .filter((allocation) => allocation.status !== 'maintenance')
    .reduce((sum, allocation) => sum + allocation.airtimeScore, 0);
  const allocations = scored.map((allocation) => {
    const postsPerWeek = allocation.status === 'maintenance'
      ? allocation.postsPerWeek
      : allocation.postsPerWeek
        + (activeScoreTotal > 0 ? remainingWeeklySlots * allocation.airtimeScore / activeScoreTotal : 0);
    return {
      ...allocation,
      postsPerWeek,
      sharePercent: weeklyCapacity > 0 ? postsPerWeek / weeklyCapacity * 100 : 0,
    };
  });

  return {
    allocations,
    weeklyCapacity,
    monthlyFloor: AIRTIME_RULES.monthlyFloor,
  };
}