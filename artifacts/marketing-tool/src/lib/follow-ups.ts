type PostForFollowUps = {
  id: string;
  businessId: string;
  project: string;
  contentType: string;
  date: string;
};

export type FollowUpPlan = {
  contentType: string;
  label: string;
  date: string;
  existingPostId?: string;
};

const followUpMap: Record<string, Array<{ offset: number; contentType: string; label: string }>> = {
  Announcement: [
    { offset: 2, contentType: 'Insight', label: 'share a useful insight' },
    { offset: 5, contentType: 'Book now', label: 'make the ask' },
  ],
  'Inside look': [
    { offset: 2, contentType: 'Proof', label: 'back it with proof' },
    { offset: 4, contentType: 'Book now', label: 'convert the interest' },
  ],
  'Book now': [
    { offset: 3, contentType: 'Proof', label: 'reinforce trust' },
  ],
  Proof: [
    { offset: 3, contentType: 'Book now', label: 'ask while trust is high' },
  ],
  Insight: [
    { offset: 4, contentType: 'Book now', label: 'turn value into a booking' },
  ],
  Recap: [
    { offset: 5, contentType: 'Insight', label: 'keep the rhythm going' },
  ],
};

export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getFollowUpPlans(post: PostForFollowUps, posts: PostForFollowUps[]): FollowUpPlan[] {
  return (followUpMap[post.contentType] ?? []).map(({ offset, contentType, label }) => {
    const date = addDaysToDate(post.date, offset);
    const targetDay = Date.parse(`${date}T00:00:00Z`);
    const existingPost = posts.find((candidate) =>
      candidate.id !== post.id
      && candidate.businessId === post.businessId
      && candidate.project === post.project
      && candidate.contentType === contentType
      && Math.abs(Date.parse(`${candidate.date}T00:00:00Z`) - targetDay) < 4 * 86400000
    );
    return { contentType, label, date, existingPostId: existingPost?.id };
  });
}