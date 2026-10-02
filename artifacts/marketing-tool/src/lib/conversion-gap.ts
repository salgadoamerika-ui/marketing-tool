import type { PostPerformance } from '@/components/post-performance-form';

export type ConversionPost = {
  id: string;
  businessId: string;
  project: string;
  date: string;
  status?: 'completed' | 'skipped';
  performance?: PostPerformance;
  suggestionKind?: string;
  sourcePostId?: string;
};

type CompletePerformance = { views: number; saves: number; bookings: number };
export const CONVERSION_RATE_THRESHOLD = 0.02;

export type ConversionGapResult = CompletePerformance & {
  bookingRate: number;
  lowConversionPosts: number;
  latestPostId: string;
  postIds: string[];
};

export type ConversionGapAssessment =
  | { status: 'needs-history' | 'not-detected'; postCount: number }
  | { status: 'detected'; postCount: number; result: ConversionGapResult; episodePostId: string };

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function hasCompletePerformance(performance?: PostPerformance): performance is CompletePerformance {
  return performance !== undefined
    && isCount(performance.views) && isCount(performance.saves) && isCount(performance.bookings);
}

export function getMeasuredServicePosts(service: ConversionPost, posts: ConversionPost[]) {
  return posts.filter((post) => post.businessId === service.businessId
    && post.project === service.project && post.status !== 'skipped'
    && hasCompletePerformance(post.performance))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function assessWindow(posts: ConversionPost[]): ConversionGapResult | null {
  const totals = { views: 0, saves: 0, bookings: 0 };
  let lowConversionPosts = 0;
  for (const post of posts) {
    const result = post.performance!;
    totals.views += result.views!;
    totals.saves += result.saves!;
    totals.bookings += result.bookings!;
    // Saves explain interest, but are never a separate booking threshold.
    if (result.views! > 0 && result.bookings! * 100 < result.views! * 2) lowConversionPosts += 1;
  }
  if (totals.views === 0 || lowConversionPosts < 2 || totals.bookings * 100 >= totals.views * 2) return null;
  return {
    ...totals,
    bookingRate: totals.bookings / totals.views,
    lowConversionPosts,
    latestPostId: posts[2].id,
    postIds: posts.map((post) => post.id),
  };
}

export function assessConversionGap(service: ConversionPost, posts: ConversionPost[]): ConversionGapAssessment {
  const measured = getMeasuredServicePosts(service, posts);
  const postCount = measured.length;
  if (postCount < 3) return { status: 'needs-history', postCount };
  const result = assessWindow(measured.slice(-3));
  if (!result) return { status: 'not-detected', postCount };

  // Reconstruct the current continuous gap. A healthy window ends the old
  // episode so previously added trust/offer posts cannot escalate a new one.
  let episodePostId = measured[2].id;
  let wasDetected = false;
  for (let index = 2; index < measured.length; index += 1) {
    const detected = assessWindow(measured.slice(index - 2, index + 1)) !== null;
    if (detected && !wasDetected) episodePostId = measured[index].id;
    wasDetected = detected;
  }
  return { status: 'detected', postCount, result, episodePostId };
}

export function getConversionGap(service: ConversionPost, posts: ConversionPost[]): ConversionGapResult | null {
  const assessment = assessConversionGap(service, posts);
  return assessment.status === 'detected' ? assessment.result : null;
}

export function getConversionGapMarkers(posts: ConversionPost[]): Set<string> {
  const services = new Map<string, ConversionPost>();
  for (const post of posts) services.set(JSON.stringify([post.businessId, post.project]), post);
  const markers = new Set<string>();
  for (const service of services.values()) {
    const assessment = assessConversionGap(service, posts);
    if (assessment.status === 'detected') markers.add(assessment.result.latestPostId);
  }
  return markers;
}