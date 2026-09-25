export type SeasonalityPost = {
  businessId: string;
  project: string;
  date: string;
  status?: 'completed' | 'skipped';
  performance?: { views?: number };
};

export type SeasonalityFinding = {
  month: number;
  yearsObserved: number[];
  averageViews: number;
  comparisonAverageViews: number;
  lift: number;
};

export const SEASONALITY_RULES = {
  minimumMeasuredPosts: 3,
  minimumRecurringYears: 2,
  minimumLift: 1.5,
} as const;

type MeasuredPost = {
  year: number;
  month: number;
  views: number;
};

function validDateParts(date: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isInteger(year)
    || year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > 31
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date
  ) {
    return null;
  }
  return { year, month };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isConsistentSpike(monthAverage: number, comparisonAverage: number): boolean {
  return comparisonAverage === 0
    ? monthAverage > 0
    : monthAverage >= comparisonAverage * SEASONALITY_RULES.minimumLift
      && monthAverage > comparisonAverage;
}

export function findSeasonalityFinding(
  businessId: string,
  service: string,
  posts: SeasonalityPost[],
  configuredMonths: number[],
): SeasonalityFinding | null {
  const measured: MeasuredPost[] = posts.flatMap((post) => {
    if (
      post.businessId !== businessId
      || post.project !== service
      || post.status === 'skipped'
      || typeof post.performance?.views !== 'number'
      || !Number.isSafeInteger(post.performance.views)
      || post.performance.views < 0
    ) {
      return [];
    }
    const dateParts = validDateParts(post.date);
    return dateParts ? [{ ...dateParts, views: post.performance.views }] : [];
  });

  if (measured.length < SEASONALITY_RULES.minimumMeasuredPosts) return null;

  const configured = new Set(configuredMonths);
  const findings: SeasonalityFinding[] = [];

  for (let month = 1; month <= 12; month += 1) {
    if (configured.has(month)) continue;

    const yearGroups = new Map<number, { peak: number[]; comparison: number[] }>();
    for (const post of measured) {
      const group = yearGroups.get(post.year) ?? { peak: [], comparison: [] };
      (post.month === month ? group.peak : group.comparison).push(post.views);
      yearGroups.set(post.year, group);
    }

    const comparableYears = [...yearGroups.entries()]
      .filter(([, group]) => group.peak.length > 0 && group.comparison.length > 0)
      .sort(([left], [right]) => left - right)
      .map(([year, group]) => ({
        year,
        peakAverage: mean(group.peak),
        comparisonAverage: mean(group.comparison),
      }));

    if (
      comparableYears.length < SEASONALITY_RULES.minimumRecurringYears
      || !comparableYears.every((year) => isConsistentSpike(year.peakAverage, year.comparisonAverage))
    ) {
      continue;
    }

    const averageViews = mean(comparableYears.map((year) => year.peakAverage));
    const comparisonAverageViews = mean(comparableYears.map((year) => year.comparisonAverage));
    findings.push({
      month,
      yearsObserved: comparableYears.map((year) => year.year),
      averageViews,
      comparisonAverageViews,
      lift: comparisonAverageViews === 0
        ? Number.MAX_SAFE_INTEGER
        : averageViews / comparisonAverageViews,
    });
  }

  return findings.sort((left, right) =>
    right.lift - left.lift || left.month - right.month
  )[0] ?? null;
}