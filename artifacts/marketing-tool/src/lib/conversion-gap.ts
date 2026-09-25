import type { PostPerformance } from '@/components/post-performance-form';

type TrackedPost = {
  performance?: PostPerformance;
};

type CompletePerformance = {
  views: number;
  saves: number;
  bookings: number;
};

export type ConversionGapResult = CompletePerformance;

export type ConversionGapAssessment =
  | { status: 'needs-results' | 'not-detected' }
  | { status: 'detected'; result: ConversionGapResult };

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function hasCompletePerformance(performance?: PostPerformance): performance is CompletePerformance {
  return performance !== undefined
    && isCount(performance.views)
    && isCount(performance.saves)
    && isCount(performance.bookings);
}

export function assessConversionGap(post: TrackedPost): ConversionGapAssessment {
  if (!hasCompletePerformance(post.performance)) return { status: 'needs-results' };
  const { views, saves, bookings } = post.performance;

  // Positive interest is required; zero bookings then passes both strict ratio checks.
  const conversionGap = views > 0 && saves > 0
    && bookings < views / 5 && bookings < saves / 5;
  if (!conversionGap) return { status: 'not-detected' };

  return {
    status: 'detected',
    result: { views, saves, bookings },
  };
}

export function getConversionGap(post: TrackedPost): ConversionGapResult | null {
  const assessment = assessConversionGap(post);
  return assessment.status === 'detected' ? assessment.result : null;
}