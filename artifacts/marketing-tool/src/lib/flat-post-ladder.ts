import { addDaysToDate } from './follow-ups.ts';

export type FlatPost = {
  id: string;
  businessId: string;
  project: string;
  date: string;
  status?: 'completed' | 'skipped';
  performance?: { views?: number };
};

type Service = { businessId: string; project: string };

export type FlatPostState = {
  streak: number;
  measuredPostCount: number;
  latestPostId?: string;
  action: 'none' | 'repost' | 'fresh-angle' | 'maintenance';
};

function hasViews(post: FlatPost): boolean {
  const views = post.performance?.views;
  return typeof views === 'number' && Number.isSafeInteger(views) && views >= 0;
}

function hasValidDate(post: FlatPost): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return false;
  const date = new Date(`${post.date}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === post.date;
}

/** Internal only: never attach this counter to cards, calendar events or badges. */
export function getFlatPostState(service: Service, posts: FlatPost[], throughDate = '9999-12-31'): FlatPostState {
  const measured = posts.filter((post) =>
    post.businessId === service.businessId && post.project === service.project
    && post.status !== 'skipped' && hasViews(post) && hasValidDate(post) && post.date <= throughDate
  ).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let totalViews = 0;
  let streak = 0;
  measured.forEach((post, index) => {
    const views = post.performance!.views!;
    totalViews += views;
    // Compare with the service average at this point in its history, including
    // this result. Future results must not reclassify an earlier recovery.
    if (index >= 2) {
      const averageViews = totalViews / (index + 1);
      streak = views < averageViews ? streak + 1 : 0;
    }
  });
  return {
    streak,
    measuredPostCount: measured.length,
    latestPostId: measured.at(-1)?.id,
    action: streak >= 4 ? 'maintenance' : streak === 3 ? 'fresh-angle' : streak === 2 ? 'repost' : 'none',
  };
}

/** Monthly pacing affects proposed dates, never the user's existing calendar. */
export function getMaintenanceSuggestionDate(service: Service, posts: FlatPost[], today: string): string {
  const servicePosts = posts.filter((post) =>
    post.businessId === service.businessId && post.project === service.project
    && post.status !== 'skipped' && hasValidDate(post)
  );
  const latestDate = servicePosts.filter((post) => post.date <= today)
    .reduce((latest, post) => post.date > latest ? post.date : latest, '');
  const futureDate = addDaysToDate(today, 2);
  const monthlyDate = latestDate ? addDaysToDate(latestDate, 30) : futureDate;
  let date = monthlyDate > futureDate ? monthlyDate : futureDate;
  for (const planned of servicePosts.filter((post) => post.date > today).sort((a, b) => a.date.localeCompare(b.date))) {
    if (planned.date > addDaysToDate(date, 29)) break;
    if (planned.date >= addDaysToDate(date, -29)) date = addDaysToDate(planned.date, 30);
  }
  return date;
}