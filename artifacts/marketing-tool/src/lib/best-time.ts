export type BestTimePost = {
  businessId: string;
  project: string;
  date: string;
  platforms: string[];
  postedTime?: string;
  status?: 'completed' | 'skipped';
  performance?: {
    views?: number;
    saves?: number;
    bookings?: number;
  };
};

export type BestTimeRecommendation = {
  mode: 'suggested' | 'learned';
  label: string;
  compactLabel: string;
  detail: string;
};

export const BEST_TIME_RULES = {
  minimumPerformancePosts: 3,
  topPerformerCount: 3,
} as const;

const platformDefaultTimes: Record<string, string> = {
  facebook: '09:00',
  instagram: '11:00',
  tiktok: '16:00',
};

const weekdayNames = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

type TimedPerformer = {
  date: string;
  postedTime: string;
  views: number;
  weekday: string;
  timeOfDay: string;
};

function isValidMetric(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function hasPerformanceNumbers(post: BestTimePost): boolean {
  return [post.performance?.views, post.performance?.saves, post.performance?.bookings]
    .some(isValidMetric);
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function validTime(time: string | undefined): time is string {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return false;
  const [hour, minute] = time.split(':').map(Number);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
}

function formatClock(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function timeOfDayLabel(time: string): string {
  const hour = Number(time.slice(0, 2));
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'overnight';
}

function suggestedRecommendation(platforms: string[]): BestTimeRecommendation {
  const selectedPlatforms = [...new Set(platforms.map((platform) => platform.trim()).filter(Boolean))];
  const entries = (selectedPlatforms.length ? selectedPlatforms : ['Other'])
    .map((platform) => ({
      platform,
      time: platformDefaultTimes[platform.toLowerCase()] ?? '12:00',
    }));
  const detail = entries
    .map(({ platform, time }) => `${platform}: ${formatClock(time)}`)
    .join(' · ');
  return {
    mode: 'suggested',
    label: 'Best time · suggested',
    compactLabel: entries.length === 1
      ? `Best time · suggested · ${formatClock(entries[0].time)}`
      : 'Best time · suggested',
    detail,
  };
}

function buildTimedPerformer(post: BestTimePost): TimedPerformer | null {
  if (
    !validDate(post.date)
    || !validTime(post.postedTime)
    || !isValidMetric(post.performance?.views)
  ) {
    return null;
  }
  const date = new Date(`${post.date}T00:00:00.000Z`);
  return {
    date: post.date,
    postedTime: post.postedTime,
    views: post.performance.views,
    weekday: weekdayNames[date.getUTCDay()],
    timeOfDay: timeOfDayLabel(post.postedTime),
  };
}

export function getBestTimeRecommendation(
  businessId: string,
  service: string,
  platforms: string[],
  posts: BestTimePost[],
): BestTimeRecommendation {
  const servicePosts = posts.filter((post) =>
    post.businessId === businessId
    && post.project === service
    && post.status !== 'skipped'
    && hasPerformanceNumbers(post)
  );
  if (servicePosts.length < BEST_TIME_RULES.minimumPerformancePosts) {
    return suggestedRecommendation(platforms);
  }

  const viewPosts = servicePosts
    .filter((post) => isValidMetric(post.performance?.views))
    .sort((left, right) =>
      right.performance!.views! - left.performance!.views!
      || left.date.localeCompare(right.date)
      || (left.postedTime ?? '').localeCompare(right.postedTime ?? '')
    );
  if (viewPosts.length < BEST_TIME_RULES.minimumPerformancePosts) {
    return suggestedRecommendation(platforms);
  }
  if (viewPosts[0].performance?.views === 0) {
    return suggestedRecommendation(platforms);
  }

  const topPerformers = viewPosts.slice(0, BEST_TIME_RULES.topPerformerCount)
    .map(buildTimedPerformer)
    .filter((post): post is TimedPerformer => post !== null);
  if (topPerformers.length < BEST_TIME_RULES.minimumPerformancePosts) {
    return suggestedRecommendation(platforms);
  }

  const patterns = new Map<string, { weekday: string; timeOfDay: string; count: number; views: number }>();
  for (const performer of topPerformers) {
    const key = `${performer.weekday}:${performer.timeOfDay}`;
    const pattern = patterns.get(key) ?? {
      weekday: performer.weekday,
      timeOfDay: performer.timeOfDay,
      count: 0,
      views: 0,
    };
    pattern.count += 1;
    pattern.views += performer.views;
    patterns.set(key, pattern);
  }
  const strongestPattern = [...patterns.values()].sort((left, right) =>
    right.count - left.count
    || right.views - left.views
    || left.weekday.localeCompare(right.weekday)
    || left.timeOfDay.localeCompare(right.timeOfDay)
  )[0];
  const period = strongestPattern.timeOfDay === 'overnight'
    ? 'overnight'
    : `${strongestPattern.timeOfDay}s`;
  const summary = `${strongestPattern.weekday} ${period}`;

  return {
    mode: 'learned',
    label: `Best time · from your results: ${summary}`,
    compactLabel: `Best time · results · ${strongestPattern.weekday.slice(0, 3)} ${period}`,
    detail: `Pattern among the ${BEST_TIME_RULES.topPerformerCount} highest-view posts with recorded times.`,
  };
}