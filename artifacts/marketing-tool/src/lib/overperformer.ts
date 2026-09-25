import type { PostPerformance } from '@/components/post-performance-form';

type TrackedPost = {
  id: string;
  businessId: string;
  project: string;
  performance?: PostPerformance;
};

export type OverperformerResult = {
  views: number;
  averageViews: number;
  multiple: number;
  postCount: number;
};

export function getOverperformer(post: TrackedPost, posts: TrackedPost[]): OverperformerResult | null {
  const views = post.performance?.views;
  if (views === undefined || !Number.isSafeInteger(views) || views < 0) return null;

  const comparableViews = posts
    .filter((item) => item.businessId === post.businessId && item.project === post.project)
    .map((item) => item.performance?.views)
    .filter((value): value is number => value !== undefined && Number.isSafeInteger(value) && value >= 0);

  if (comparableViews.length < 3) return null;

  const averageViews = comparableViews.reduce((total, value) => total + value, 0) / comparableViews.length;
  if (averageViews === 0 || views < 2 * averageViews) return null;

  return {
    views,
    averageViews,
    multiple: views / averageViews,
    postCount: comparableViews.length,
  };
}