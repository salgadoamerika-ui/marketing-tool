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

export type ConversionGapResult = CompletePerformance;

export type ConversionGapAssessment =
  | { status: 'needs-results' | 'needs-history' | 'not-detected'; postCount: number }
  | { status: 'detected'; postCount: number; result: ConversionGapResult };

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function hasCompletePerformance(performance?: PostPerformance): performance is CompletePerformance {
  return performance !== undefined
    && isCount(performance.views)
    && isCount(performance.saves)
    && isCount(performance.bookings);
}

export function assessConversionGap(post: TrackedPost, posts: TrackedPost[]): ConversionGapAssessment {
  const postCount = posts.filter((item) =>
    item.businessId === post.businessId
    && item.project === post.project
    && hasCompletePerformance(item.performance)
  ).length;

  if (!hasCompletePerformance(post.performance)) return { status: 'needs-results', postCount };
  if (postCount < 3) return { status: 'needs-history', postCount };
  const { views, saves, bookings } = post.performance;

  // Positive interest is required; zero bookings then passes both strict ratio checks.
  const conversionGap = views > 0 && saves > 0
    && bookings < views / 5 && bookings < saves / 5;
  if (!conversionGap) return { status: 'not-detected', postCount };

  return {
    status: 'detected',
    postCount,
    result: { views, saves, bookings },
  };
}

export function getConversionGap(post: TrackedPost, posts: TrackedPost[]): ConversionGapResult | null {
  const assessment = assessConversionGap(post, posts);
  return assessment.status === 'detected' ? assessment.result : null;
}