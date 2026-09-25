import type { PostPerformance } from '@/components/post-performance-form';

type TrackedPost = {
  businessId: string;
  project: string;
  performance?: PostPerformance;
};

type CompletePerformance = {
  views: number;
  saves: number;
  bookings: number;
};

export type ConversionGapResult = CompletePerformance & {
  averageViews: number;
  averageSaves: number;
  averageBookings: number;
  postCount: number;
};

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function hasCompletePerformance(performance?: PostPerformance): performance is CompletePerformance {
  return performance !== undefined
    && isCount(performance.views)
    && isCount(performance.saves)
    && isCount(performance.bookings);
}

export function getConversionGap(post: TrackedPost, posts: TrackedPost[]): ConversionGapResult | null {
  if (!hasCompletePerformance(post.performance)) return null;

  const comparable = posts
    .filter((item) => item.businessId === post.businessId && item.project === post.project)
    .map((item) => item.performance)
    .filter(hasCompletePerformance);

  if (comparable.length < 3) return null;

  const averageViews = comparable.reduce((total, item) => total + item.views, 0) / comparable.length;
  const averageSaves = comparable.reduce((total, item) => total + item.saves, 0) / comparable.length;
  const averageBookings = comparable.reduce((total, item) => total + item.bookings, 0) / comparable.length;
  const { views, saves, bookings } = post.performance;

  // A zero average should not make zero views or zero saves count as strong engagement.
  const strongInterest = views > 0 && saves > 0 && views >= averageViews && saves >= averageSaves;
  const weakConversion = bookings === 0 || (averageBookings > 0 && bookings <= averageBookings / 2);
  if (!strongInterest || !weakConversion) return null;

  return { views, saves, bookings, averageViews, averageSaves, averageBookings, postCount: comparable.length };
}