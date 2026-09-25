type PostForFollowUps = {
  id: string;
  businessId: string;
  project: string;
  contentType: string;
  date: string;
  title?: string;
  status?: 'completed' | 'skipped';
};

type SequenceStep = {
  offset: number;
  contentType: string;
  label: string;
};

export type FollowUpPlan = Omit<SequenceStep, 'offset'> & {
  date: string;
  existingPostId?: string;
  existingPostTitle?: string;
  blocked?: boolean;
};

const followUpMap: Record<string, SequenceStep[]> = {
  Announcement: [
    { offset: 2, contentType: 'Inside look', label: 'show them inside' },
    { offset: 5, contentType: 'Book now', label: 'make the ask' },
  ],
  'Inside look': [
    { offset: 2, contentType: 'Testimonial', label: 'share a client testimonial' },
    { offset: 4, contentType: 'Book now', label: 'make the ask' },
  ],
  'Book now': [
    { offset: 3, contentType: 'Testimonial', label: 'build trust with a testimonial' },
    { offset: 6, contentType: 'Pricing', label: 'explain the pricing' },
  ],
  Enrollment: [
    { offset: 3, contentType: 'Testimonial', label: 'build trust with a testimonial' },
    { offset: 6, contentType: 'Pricing', label: 'explain the pricing' },
  ],
  Pricing: [
    { offset: 4, contentType: 'Promo', label: 'make the closing offer' },
  ],
  Testimonial: [
    { offset: 3, contentType: 'Book now', label: 'make the ask while trust is high' },
  ],
  Proof: [
    { offset: 3, contentType: 'Book now', label: 'make the ask while trust is high' },
  ],
  Insight: [
    { offset: 4, contentType: 'Book now', label: 'offer a soft booking CTA' },
    { offset: 9, contentType: 'Insight', label: 'keep the value rhythm' },
  ],
  'Fresh angle': [],
};

const testimonialTypes = new Set(['Testimonial', 'Proof']);
const bookingTypes = new Set(['Book now', 'Enrollment']);

export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isSameSequenceType(actual: string, expected: string): boolean {
  if (testimonialTypes.has(actual) && testimonialTypes.has(expected)) return true;
  if (bookingTypes.has(actual) && bookingTypes.has(expected)) return true;
  return actual === expected;
}

export function getFollowUpPlans(
  post: PostForFollowUps,
  posts: PostForFollowUps[],
  occupiedDates: string[] = [],
): FollowUpPlan[] {
  const steps = followUpMap[post.contentType] ?? [
    { offset: 5, contentType: 'Fresh angle', label: 'try a fresh angle' },
  ];
  const servicePosts = posts.filter((candidate) =>
    candidate.businessId === post.businessId && candidate.project === post.project
  );
  const reservedDates = new Set([
    ...occupiedDates,
    ...servicePosts.filter((candidate) => candidate.status !== 'skipped').map((candidate) => candidate.date),
  ]);

  return steps.map((step) => {
    const { offset, ...plannedStep } = step;
    const duplicateSearchEnd = addDaysToDate(post.date, Math.max(7, offset));
    const existingPost = servicePosts
      .filter((candidate) =>
        candidate.id !== post.id
        && candidate.status !== 'skipped'
        && isSameSequenceType(candidate.contentType, step.contentType)
        && candidate.date > post.date
        && candidate.date <= duplicateSearchEnd
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (existingPost) {
      return {
        ...plannedStep,
        date: existingPost.date,
        existingPostId: existingPost.id,
        existingPostTitle: existingPost.title,
      };
    }

    const intendedDate = addDaysToDate(post.date, offset);
    for (let nudge = 0; nudge <= 7; nudge += 1) {
      const candidateDate = addDaysToDate(intendedDate, nudge);
      if (!reservedDates.has(candidateDate)) {
        reservedDates.add(candidateDate);
        return { ...plannedStep, date: candidateDate };
      }
    }

    return { ...plannedStep, date: intendedDate, blocked: true };
  });
}