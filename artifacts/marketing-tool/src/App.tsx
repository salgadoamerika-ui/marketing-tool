import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PostPerformanceForm, type PostPerformance } from '@/components/post-performance-form';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type EventTone = 'rose' | 'lavender' | 'sage' | 'sand' | 'blue' | 'blush' | 'muted';

type CalendarEvent = {
  day: number;
  title: string;
  detail?: string;
  tone: EventTone;
  id?: string;
  isSuggestion?: boolean;
};

type Distribution = 'organic' | 'paid';
type Platform = string;

type UserPost = {
  id: string;
  businessId: string;
  project: string;
  contentType: string;
  title: string;
  date: string;
  platforms: Platform[];
  distribution: Distribution;
  isSuggestion?: boolean;
  budget?: number;
  runLength?: number;
  performance?: PostPerformance;
};

type PostForm = {
  project: string;
  contentType: string;
  title: string;
  date: string;
  platforms: Platform[];
  distribution: Distribution;
  budget: string;
  runLength: string;
};

type Business = {
  id: string;
  name: string;
  descriptor: string;
  focus: string;
  projects: string[];
  palette: Array<{ label: string; tone: EventTone }>;
  events: Record<string, CalendarEvent[]>;
};

const userPostsStorageKey = 'marketing-tool.user-posts';
const platformOptionsStorageKey = 'marketing-tool.platform-options';
const defaultPlatformOptions: Platform[] = ['Facebook', 'Instagram', 'TikTok'];
const contentTypes = ['Announcement', 'Insight', 'Inside look', 'Proof', 'Book now', 'Recap'];
const contentTypeRationales: Record<string, string> = {
  Announcement: 'Opens the campaign. You lead with awareness before asking for anything.',
  'Inside look': "You've announced — now show them inside to turn interest into desire.",
  'Book now': "The audience is warm. Now's when the ask converts.",
  Proof: 'Proof beats claims — real results move people who are interested but unsure.',
  Insight: 'Value-first content builds trust before you ask for the booking.',
  Recap: 'Keeps the service visible and reinforces what you offer.',
};
// Phase 3 — the brain: what move naturally comes next after each content type
const followUpMap: Record<string, Array<{ offset: number; contentType: string; label: string }>> = {
  'Announcement': [
    { offset: 2, contentType: 'Inside look', label: 'show them inside' },
    { offset: 5, contentType: 'Book now', label: 'make the ask' },
  ],
  'Inside look': [
    { offset: 2, contentType: 'Proof', label: 'back it with proof' },
    { offset: 4, contentType: 'Book now', label: 'convert the interest' },
  ],
  'Book now': [
    { offset: 3, contentType: 'Proof', label: 'reinforce trust' },
  ],
  'Proof': [
    { offset: 3, contentType: 'Book now', label: 'ask while trust is high' },
  ],
  'Insight': [
    { offset: 4, contentType: 'Book now', label: 'turn value into a booking' },
  ],
  'Recap': [
    { offset: 5, contentType: 'Insight', label: 'keep the rhythm going' },
  ],
};

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const businessData: Business[] = [
  {
    id: 'mosaic',
    name: 'Mosaic Legal',
    descriptor: 'One calm view for every service line.',
    focus: 'Fall programs are carrying the month, with evergreen services kept warm.',
    projects: ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'],
    palette: [
      { label: 'Fall programs', tone: 'rose' },
      { label: 'Tax planning', tone: 'sand' },
      { label: 'Divorce', tone: 'lavender' },
      { label: 'Immigration', tone: 'blue' },
      { label: 'Insurance', tone: 'sage' },
    ],
    events: {
      '2026-08': [
        { day: 4, title: 'Tax planning: common filing errors', detail: 'Post', tone: 'sand' },
        { day: 8, title: 'Immigration: document checklist', detail: 'Inside look', tone: 'blue' },
        { day: 13, title: 'Fall programs: save the date', detail: 'Announcement', tone: 'rose' },
        { day: 18, title: 'Divorce: first conversation', detail: 'Insight', tone: 'lavender' },
        { day: 25, title: 'Insurance review: what changed?', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 2, title: 'Fall programs open', detail: 'Announcement', tone: 'rose' },
        { day: 4, title: 'Tax planning for a new quarter', detail: 'Insight', tone: 'sand' },
        { day: 7, title: 'Divorce: the first practical step', detail: 'Inside look', tone: 'lavender' },
        { day: 9, title: 'Meet the fall team', detail: 'Inside look', tone: 'rose' },
        { day: 11, title: 'Immigration: what to bring', detail: 'Insight', tone: 'blue' },
        { day: 14, title: 'Insurance review week', detail: 'Book now', tone: 'sage' },
        { day: 16, title: 'Fall programs: early places', detail: 'Proof', tone: 'blush' },
        { day: 18, title: 'Tax planning: a cleaner close', detail: 'Book now', tone: 'sand' },
        { day: 21, title: 'Divorce consults, explained', detail: 'Announcement', tone: 'lavender' },
        { day: 23, title: 'Fall programs: behind the scenes', detail: 'Inside look', tone: 'rose' },
        { day: 25, title: 'Immigration clinic', detail: 'Book now', tone: 'blue' },
        { day: 28, title: 'Insurance questions answered', detail: 'Recap', tone: 'sage' },
        { day: 30, title: 'Fall programs: last places', detail: 'Closing note', tone: 'blush' },
      ],
      '2026-10': [
        { day: 2, title: 'Fall programs: final call', detail: 'Announcement', tone: 'rose' },
        { day: 6, title: 'Insurance renewal checklist', detail: 'Insight', tone: 'sage' },
        { day: 10, title: 'Divorce: what happens next', detail: 'Inside look', tone: 'lavender' },
        { day: 15, title: 'Tax planning before year-end', detail: 'Book now', tone: 'sand' },
        { day: 22, title: 'Immigration Q&A', detail: 'Insight', tone: 'blue' },
        { day: 29, title: 'October service recap', detail: 'Recap', tone: 'muted' },
      ],
    },
  },
  {
    id: 'northline',
    name: 'Northline Financial',
    descriptor: 'Keep the useful work in motion.',
    focus: 'Year-end planning is moving forward while the weekly rhythm stays visible.',
    projects: ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'],
    palette: [
      { label: 'Fall programs', tone: 'rose' },
      { label: 'Tax planning', tone: 'sand' },
      { label: 'Divorce', tone: 'lavender' },
      { label: 'Immigration', tone: 'blue' },
      { label: 'Insurance', tone: 'sage' },
    ],
    events: {
      '2026-08': [
        { day: 6, title: 'Quarterly planning notes', detail: 'Insight', tone: 'sand' },
        { day: 12, title: 'Fall programs: early places', detail: 'Proof', tone: 'rose' },
        { day: 20, title: 'Insurance review office hours', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 3, title: 'Fall programs: planning ahead', detail: 'Announcement', tone: 'rose' },
        { day: 8, title: 'Tax planning for the final quarter', detail: 'Insight', tone: 'sand' },
        { day: 12, title: 'What an insurance review covers', detail: 'Inside look', tone: 'sage' },
        { day: 17, title: 'Year-end decisions, made simple', detail: 'Book now', tone: 'sand' },
        { day: 24, title: 'Immigration: the timeline view', detail: 'Inside look', tone: 'blue' },
      ],
      '2026-10': [
        { day: 3, title: 'Year-end planning begins', detail: 'Announcement', tone: 'sand' },
        { day: 14, title: 'Insurance renewal questions', detail: 'Insight', tone: 'sage' },
        { day: 24, title: 'Tax planning: final spots', detail: 'Book now', tone: 'sand' },
      ],
    },
  },
  {
    id: 'harbor',
    name: 'Harbor Coverage',
    descriptor: 'A steadier rhythm for the people you serve.',
    focus: 'Insurance leads the calendar, with a few useful cross-service reminders alongside it.',
    projects: ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'],
    palette: [
      { label: 'Fall programs', tone: 'rose' },
      { label: 'Tax planning', tone: 'sand' },
      { label: 'Divorce', tone: 'lavender' },
      { label: 'Immigration', tone: 'blue' },
      { label: 'Insurance', tone: 'sage' },
    ],
    events: {
      '2026-08': [
        { day: 5, title: 'Insurance review: a reset', detail: 'Announcement', tone: 'sage' },
        { day: 19, title: 'The coverage check-in', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 1, title: 'Insurance review week', detail: 'Announcement', tone: 'sage' },
        { day: 6, title: 'Three questions to ask now', detail: 'Insight', tone: 'sage' },
        { day: 15, title: 'Tax planning: the early look', detail: 'Inside look', tone: 'sand' },
        { day: 20, title: 'Coverage stories from the field', detail: 'Proof', tone: 'blush' },
        { day: 26, title: 'Immigration support, explained', detail: 'Insight', tone: 'blue' },
      ],
      '2026-10': [
        { day: 7, title: 'Renewal season, without the rush', detail: 'Inside look', tone: 'sage' },
        { day: 16, title: 'Insurance review office hours', detail: 'Book now', tone: 'sage' },
        { day: 27, title: 'October questions, answered', detail: 'Recap', tone: 'muted' },
      ],
    },
  },
];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function makeCalendarDays(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(date.getFullYear(), date.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultPostDate(visibleMonth: Date) {
  const today = new Date();
  return today.getFullYear() === visibleMonth.getFullYear() && today.getMonth() === visibleMonth.getMonth()
    ? formatDateInput(today)
    : formatDateInput(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
}

function createPostForm(date: string): PostForm {
  return {
    project: '',
    contentType: '',
    title: '',
    date,
    platforms: [],
    distribution: 'organic',
    budget: '',
    runLength: '',
  };
}

function readAvailablePlatforms() {
  if (typeof window === 'undefined') return defaultPlatformOptions;

  try {
    const storedPlatforms = window.localStorage.getItem(platformOptionsStorageKey);
    if (!storedPlatforms) return defaultPlatformOptions;
    const parsedPlatforms: unknown = JSON.parse(storedPlatforms);
    if (!Array.isArray(parsedPlatforms)) return defaultPlatformOptions;

    const customPlatforms = parsedPlatforms.filter(
      (platform): platform is string => typeof platform === 'string' && platform.trim().length > 0,
    );
    return [...defaultPlatformOptions, ...customPlatforms.filter(
      (platform, index) => customPlatforms.findIndex((item) => item.toLowerCase() === platform.toLowerCase()) === index
        && !defaultPlatformOptions.some((defaultPlatform) => defaultPlatform.toLowerCase() === platform.toLowerCase()),
    )];
  } catch (error) {
    console.warn('Saved platform options could not be loaded.', error);
    return defaultPlatformOptions;
  }
}

function isUserPost(value: unknown): value is UserPost {
  if (!value || typeof value !== 'object') return false;
  const post = value as Partial<UserPost>;
  return Boolean(
    typeof post.id === 'string'
      && typeof post.businessId === 'string'
      && typeof post.project === 'string'
      && typeof post.contentType === 'string'
      && typeof post.title === 'string'
      && typeof post.date === 'string'
      && Array.isArray(post.platforms)
      && post.platforms.every((platform) => typeof platform === 'string' && platform.trim().length > 0)
      && (post.distribution === 'organic' || post.distribution === 'paid'),
  );
}

function readUserPosts() {
  if (typeof window === 'undefined') return [];

  try {
    const storedPosts = window.localStorage.getItem(userPostsStorageKey);
    if (!storedPosts) return [];
    const parsedPosts: unknown = JSON.parse(storedPosts);
    return Array.isArray(parsedPosts) ? parsedPosts.filter(isUserPost) : [];
  } catch (error) {
    console.warn('Saved calendar posts could not be loaded.', error);
    return [];
  }
}

function getPostTone(project: string, business: Business): EventTone {
  return business.palette.find((item) => item.label === project)?.tone ?? 'rose';
}

function createPostId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `post-${Date.now()}`;
}

function getPostDetail(post: UserPost) {
  const channelText = post.platforms.join(', ');
  const distributionText = post.distribution === 'paid'
    ? `Paid · $${post.budget?.toLocaleString() ?? '0'} · ${post.runLength ?? 0}d`
    : 'Organic';
  return `${post.contentType} · ${channelText} · ${distributionText}`;
}

function formatPostDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function CalendarSurface() {
  const [activeBusinessId, setActiveBusinessId] = useState('mosaic');
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 8, 1));
  const [statusMessage, setStatusMessage] = useState('');
  const [userPosts, setUserPosts] = useState<UserPost[]>(readUserPosts);
  const [isPostFormOpen, setIsPostFormOpen] = useState(false);
  const [postForm, setPostForm] = useState<PostForm>(() => createPostForm(formatDateInput(new Date())));
  const [formError, setFormError] = useState('');
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>(readAvailablePlatforms);
  const [isAddingPlatform, setIsAddingPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [platformError, setPlatformError] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const activeBusiness = businessData.find((business) => business.id === activeBusinessId) ?? businessData[0];
  const days = useMemo(() => makeCalendarDays(visibleMonth), [visibleMonth]);
  const events = activeBusiness.events[monthKey(visibleMonth)] ?? [];
  const activeBusinessPosts = userPosts.filter((post) => post.businessId === activeBusiness.id);
  const monthPosts = activeBusinessPosts.filter((post) => post.date.startsWith(monthKey(visibleMonth)));
  const selectedUserPost = userPosts.find((post) => post.id === selectedPostId);
  const calendarEvents = [
    ...events,
    ...monthPosts.map((post) => ({
      id: post.id,
      day: Number(post.date.slice(-2)),
      title: post.title,
      detail: getPostDetail(post),
      tone: getPostTone(post.project, activeBusiness),
      isSuggestion: post.isSuggestion,
    })),
  ];
  const todayKey = '2026-09-10';

  useEffect(() => {
    window.localStorage.setItem(userPostsStorageKey, JSON.stringify(userPosts));
  }, [userPosts]);

  useEffect(() => {
    window.localStorage.setItem(platformOptionsStorageKey, JSON.stringify(availablePlatforms));
  }, [availablePlatforms]);

  const shiftMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    setStatusMessage('');
  };

  const showActionMessage = (message: string) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(''), 3000);
  };

  const openPostForm = () => {
    setPostForm(createPostForm(defaultPostDate(visibleMonth)));
    setFormError('');
    setIsAddingPlatform(false);
    setNewPlatformName('');
    setPlatformError('');
    setStatusMessage('');
    setIsPostFormOpen(true);
  };

  const closePostForm = () => {
    setIsPostFormOpen(false);
    setFormError('');
    setIsAddingPlatform(false);
    setNewPlatformName('');
    setPlatformError('');
  };

  const closeSelectedPost = () => setSelectedPostId(null);

  const updatePostForm = <K extends keyof PostForm>(field: K, value: PostForm[K]) => {
    setPostForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const togglePlatform = (platform: Platform) => {
    setPostForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
    setFormError('');
  };

  const handleAddPlatform = () => {
    const normalizedName = newPlatformName.trim();

    if (!normalizedName) {
      setPlatformError('Enter a platform name first.');
      return;
    }

    if (normalizedName.length > 40) {
      setPlatformError('Keep the platform name under 40 characters.');
      return;
    }

    const existingPlatform = availablePlatforms.find(
      (platform) => platform.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (existingPlatform) {
      setPlatformError('That platform is already available.');
      return;
    }

    setAvailablePlatforms((current) => [...current, normalizedName]);
    setPostForm((current) => ({ ...current, platforms: [...current.platforms, normalizedName] }));
    setNewPlatformName('');
    setIsAddingPlatform(false);
    setPlatformError('');
  };

  const handlePostSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!postForm.project || !postForm.contentType || !postForm.title.trim() || !postForm.date) {
      setFormError('Complete the required fields before saving this post.');
      return;
    }

    if (postForm.platforms.length === 0) {
      setFormError('Choose at least one platform for this post.');
      return;
    }

    const budget = Number(postForm.budget);
    const runLength = Number(postForm.runLength);
    if (postForm.distribution === 'paid' && (!Number.isFinite(budget) || budget <= 0 || !Number.isInteger(runLength) || runLength <= 0)) {
      setFormError('Add a budget and a run length of at least one day for boosted posts.');
      return;
    }

    const savedPost: UserPost = {
      id: createPostId(),
      businessId: activeBusiness.id,
      project: postForm.project,
      contentType: postForm.contentType,
      title: postForm.title.trim(),
      date: postForm.date,
      platforms: postForm.platforms,
      distribution: postForm.distribution,
      ...(postForm.distribution === 'paid' ? { budget, runLength } : {}),
    };
    // create suggested follow-up posts based on what was just logged
    const followUps = followUpMap[savedPost.contentType] ?? [];
    const suggestions: UserPost[] = followUps
      .map((f) => ({
        id: createPostId(),
        businessId: activeBusiness.id,
        project: savedPost.project,
        contentType: f.contentType,
        title: `${savedPost.project}: ${f.label}`,
        date: addDaysToDate(savedPost.date, f.offset),
        platforms: savedPost.platforms,
        distribution: 'organic' as Distribution,
        isSuggestion: true,
      }))
      // anti-duplicate: skip if a post of that type already exists within a few days
      .filter((sugg) => !userPosts.some(
        (p) => p.businessId === activeBusiness.id
          && p.contentType === sugg.contentType
          && Math.abs(new Date(p.date).getTime() - new Date(sugg.date).getTime()) < 4 * 86400000,
      ));

    setUserPosts((current) => [...current, savedPost, ...suggestions]);
    setVisibleMonth(new Date(`${savedPost.date}T12:00:00`));
    closePostForm();
    showActionMessage(`Added “${savedPost.title}” to the calendar.`);
  };

  const handleDeletePost = () => {
    if (!selectedUserPost) return;

    setUserPosts((current) => current.filter((post) => post.id !== selectedUserPost.id));
    setSelectedPostId(null);
    showActionMessage(`Deleted “${selectedUserPost.title}” from the calendar.`);
  };

  return (
    <main className="calendar-page">
      <div className="calendar-shell">
        <nav className="business-tabs" aria-label="Businesses">
          {businessData.map((business) => (
            <button
              className={`business-tab ${business.id === activeBusiness.id ? 'active' : ''}`}
              key={business.id}
              onClick={() => {
                setActiveBusinessId(business.id);
                setStatusMessage('');
                closeSelectedPost();
                closePostForm();
              }}
              type="button"
            >
              <span className="business-dot" aria-hidden="true" />
              {business.name}
            </button>
          ))}
          <button
            aria-label="Add a business"
            className="business-tab business-tab-add"
            onClick={() => showActionMessage('Business workspaces will stay separate as this calendar grows.')}
            type="button"
          >
            <Plus size={17} strokeWidth={1.7} />
          </button>
        </nav>

        <header className="calendar-header">
          <div>
            <p className="calendar-kicker">Monthly workspace</p>
            <h1 className="calendar-title">
              {monthFormatter.format(visibleMonth).split(' ')[0]} <em>{visibleMonth.getFullYear()}</em>
            </h1>
            <p className="calendar-subtitle">{activeBusiness.descriptor} {activeBusiness.focus}</p>
          </div>
          <div className="header-actions">
            <div className="month-nav" aria-label="Change month">
              <button aria-label="Previous month" className="icon-button" onClick={() => shiftMonth(-1)} type="button">
                <ChevronLeft size={18} strokeWidth={1.7} />
              </button>
              <span className="month-nav-label">{monthFormatter.format(visibleMonth)}</span>
              <button aria-label="Next month" className="icon-button" onClick={() => shiftMonth(1)} type="button">
                <ChevronRight size={18} strokeWidth={1.7} />
              </button>
            </div>
            <button className="add-post" onClick={openPostForm} type="button">
              <Plus size={15} strokeWidth={2.2} />
              Add post
            </button>
          </div>
        </header>

        <div className="calendar-toolbar">
          <p className="toolbar-note">
            <strong>{calendarEvents.length} planned moments</strong> · {activeBusiness.name}
          </p>
          <div className="view-toggle" aria-label="Calendar view">
            <button className="view-option active" type="button">Month</button>
            <button
              className="view-option"
              disabled
              onClick={() => showActionMessage('Week view is coming after the monthly workspace.')}
              type="button"
            >
              Week
            </button>
          </div>
        </div>

        <div className="content-layout">
          <section aria-label={`${monthFormatter.format(visibleMonth)} content calendar`} className="calendar-card">
            <div className="days-header">
              {dayNames.map((dayName) => <span key={dayName}>{dayName.slice(0, 3)}</span>)}
            </div>
            <div className="calendar-grid">
              {days.map((day) => {
                const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
                const dayEvents = dateKey === monthKey(visibleMonth)
                  ? calendarEvents.filter((event) => event.day === day.getDate())
                  : [];
                const isOutside = day.getMonth() !== visibleMonth.getMonth();
                const isToday = `${dateKey}-${String(day.getDate()).padStart(2, '0')}` === todayKey;

                return (
                  <div className={`day-cell ${isOutside ? 'outside' : ''}`} key={day.toISOString()}>
                    <span className={`day-number ${isOutside ? 'outside' : ''} ${isToday ? 'today' : ''}`}>
                      {day.getDate()}
                    </span>
                    <div className="day-events">
                      {dayEvents.map((event) => {
                        const eventContent = (
                          <>
                            {event.title}
                            {event.detail && <small>{event.detail}</small>}
                          </>
                        );

                        return event.id ? (
                          <button
                            aria-label={`Open saved post: ${event.title}`}
                            className={`event-chip event-chip-button event-${event.tone}${event.isSuggestion ? ' event-chip-suggestion' : ''}`}
                            key={`${event.id}-${event.day}-${event.title}`}
                            onClick={() => setSelectedPostId(event.id ?? null)}
                            title="Select to view or delete this saved post"
                            type="button"
                          >
                            {eventContent}
                          </button>
                        ) : (
                          <div
                            className={`event-chip event-${event.tone}`}
                            key={`${event.day}-${event.title}`}
                            title={event.detail}
                          >
                            {eventContent}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="sidebar">
            <section className="insight-card tint">
              <p className="insight-eyebrow">This month at a glance</p>
              <h2>Keep the signal warm.</h2>
              <p>{activeBusiness.focus}</p>
              <div className="focus-list">
                {activeBusiness.palette.map((item) => (
                  <div className="focus-row" key={item.label}>
                    <span className={`focus-dot ${item.tone}`} />
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="heartbeat">
                <span className="heartbeat-mark"><Activity size={14} strokeWidth={1.8} /></span>
                <div>
                  <strong>Weekly heartbeat</strong>
                  <span>One check-in keeps every service moving.</span>
                </div>
              </div>
            </section>

            <section className="insight-card">
              <p className="legend-title">Content threads</p>
              <div className="legend">
                {activeBusiness.palette.map((item) => (
                  <div className="legend-item" key={item.label}>
                    <span className={`legend-swatch event-${item.tone}`} />
                    {item.label}
                  </div>
                ))}
              </div>
              {statusMessage && <p className="calendar-status" role="status">{statusMessage}</p>}
            </section>
          </aside>
        </div>

        {isPostFormOpen && (
          <div
            className="post-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePostForm();
            }}
            role="presentation"
          >
            <section aria-labelledby="post-form-title" aria-modal="true" className="post-modal" role="dialog">
              <div className="post-modal-header">
                <div>
                  <p className="post-modal-kicker">New calendar moment</p>
                  <h2 id="post-form-title">Add a post</h2>
                  <p className="post-modal-intro">Plan the next piece for {activeBusiness.name}.</p>
                </div>
                <button aria-label="Close add post form" className="modal-close" onClick={closePostForm} type="button">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>

              <form className="post-form" onSubmit={handlePostSubmit}>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Service / project <b>*</b></span>
                    <select
                      onChange={(event) => updatePostForm('project', event.target.value)}
                      required
                      value={postForm.project}
                    >
                      <option value="">Choose a project</option>
                      {activeBusiness.projects.map((project) => <option key={project} value={project}>{project}</option>)}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Content type <b>*</b></span>
                    <select
                      onChange={(event) => updatePostForm('contentType', event.target.value)}
                      required
                      value={postForm.contentType}
                    >
                      <option value="">Choose a type</option>
                      {contentTypes.map((contentType) => <option key={contentType} value={contentType}>{contentType}</option>)}
                    </select>
                  </label>
                </div>

                <label className="form-field">
                  <span>Post title / topic <b>*</b></span>
                  <input
                    onChange={(event) => updatePostForm('title', event.target.value)}
                    placeholder="What should people know?"
                    required
                    type="text"
                    value={postForm.title}
                  />
                </label>

                <label className="form-field">
                  <span>Date <b>*</b></span>
                  <span className="date-input-wrap">
                    <CalendarDays size={15} strokeWidth={1.8} />
                    <input
                      aria-label="Post date"
                      onChange={(event) => updatePostForm('date', event.target.value)}
                      required
                      type="date"
                      value={postForm.date}
                    />
                  </span>
                </label>

                <fieldset className="form-fieldset">
                  <legend>Platforms <b>*</b></legend>
                  <div className="platform-options">
                    {availablePlatforms.map((platform) => {
                      const selected = postForm.platforms.includes(platform);
                      return (
                        <label className={`platform-option ${selected ? 'selected' : ''}`} key={platform}>
                          <input
                            checked={selected}
                            onChange={() => togglePlatform(platform)}
                            type="checkbox"
                          />
                          <span className="platform-check">{selected && <Check size={13} strokeWidth={2.2} />}</span>
                          {platform}
                        </label>
                      );
                    })}
                    {isAddingPlatform ? (
                      <div
                        className="platform-add-form"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddPlatform();
                          }
                        }}
                      >
                        <input
                          aria-label="New platform name"
                          autoFocus
                          maxLength={40}
                          onChange={(event) => {
                            setNewPlatformName(event.target.value);
                            setPlatformError('');
                          }}
                          placeholder="Platform name"
                          type="text"
                          value={newPlatformName}
                        />
                        <button className="platform-add-save" onClick={handleAddPlatform} type="button">Save</button>
                        <button
                          aria-label="Cancel adding platform"
                          className="platform-add-cancel"
                          onClick={() => {
                            setIsAddingPlatform(false);
                            setNewPlatformName('');
                            setPlatformError('');
                          }}
                          type="button"
                        >
                          <X size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="platform-add-option"
                        onClick={() => {
                          setIsAddingPlatform(true);
                          setPlatformError('');
                        }}
                        type="button"
                      >
                        <Plus size={14} strokeWidth={2} />
                        Add platform option
                      </button>
                    )}
                  </div>
                    <p className="platform-note">Saved platform options stay available for future posts.</p>
                    {platformError && <p className="form-error" role="alert">{platformError}</p>}
                </fieldset>

                <fieldset className="form-fieldset">
                  <legend>Distribution</legend>
                  <div className="distribution-options">
                    <label className={`distribution-option ${postForm.distribution === 'organic' ? 'selected' : ''}`}>
                      <input
                        checked={postForm.distribution === 'organic'}
                        name="distribution"
                        onChange={() => updatePostForm('distribution', 'organic')}
                        type="radio"
                        value="organic"
                      />
                      <span>
                        <strong>Organic</strong>
                        <small>Publish to your usual audience</small>
                      </span>
                    </label>
                    <label className={`distribution-option ${postForm.distribution === 'paid' ? 'selected' : ''}`}>
                      <input
                        checked={postForm.distribution === 'paid'}
                        name="distribution"
                        onChange={() => updatePostForm('distribution', 'paid')}
                        type="radio"
                        value="paid"
                      />
                      <span>
                        <strong>Paid / boosted</strong>
                        <small>Put budget behind this post</small>
                      </span>
                    </label>
                  </div>
                </fieldset>

                {postForm.distribution === 'paid' && (
                  <div className="form-grid paid-fields">
                    <label className="form-field">
                      <span>Budget <b>*</b></span>
                      <span className="number-input-wrap">
                        <span>$</span>
                        <input
                          min="0.01"
                          onChange={(event) => updatePostForm('budget', event.target.value)}
                          placeholder="250"
                          required
                          step="0.01"
                          type="number"
                          value={postForm.budget}
                        />
                      </span>
                    </label>
                    <label className="form-field">
                      <span>Run length <b>*</b></span>
                      <span className="number-input-wrap">
                        <input
                          min="1"
                          onChange={(event) => updatePostForm('runLength', event.target.value)}
                          placeholder="7"
                          required
                          type="number"
                          value={postForm.runLength}
                        />
                        <span>days</span>
                      </span>
                    </label>
                  </div>
                )}

                {formError && <p className="form-error" role="alert">{formError}</p>}

                <div className="post-form-actions">
                  <button className="cancel-button" onClick={closePostForm} type="button">Cancel</button>
                  <button className="save-post-button" type="submit">Save post</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {selectedUserPost && (
          <div
            className="post-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSelectedPost();
            }}
            role="presentation"
          >
            <section aria-labelledby="selected-post-title" aria-modal="true" className="post-modal post-detail-modal" role="dialog">
              <div className="post-modal-header">
                <div>
                  <p className="post-modal-kicker">Saved calendar moment</p>
                  <h2 id="selected-post-title">{selectedUserPost.title}</h2>
                  <p className="post-modal-intro">Saved for {activeBusiness.name}.</p>
                </div>
                <button aria-label="Close saved post details" className="modal-close" onClick={closeSelectedPost} type="button">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>

              <div className="post-detail-body">
                <div className={`post-detail-project event-${getPostTone(selectedUserPost.project, activeBusiness)}`}>
                  {selectedUserPost.project}
                </div>
                <div className="post-detail-list">
                  <div>
                    <span>Date</span>
                    <strong>{formatPostDate(selectedUserPost.date)}</strong>
                  </div>
                  <div>
                    <span>Content type</span>
                    <strong>{selectedUserPost.contentType}</strong>
                  </div>
                  <div>
                    <span>Platforms</span>
                    <strong>{selectedUserPost.platforms.join(', ')}</strong>
                  </div>
                  <div>
                    <span>Distribution</span>
                    <strong>
                      {selectedUserPost.distribution === 'paid'
                        ? `Paid / boosted · $${selectedUserPost.budget?.toLocaleString() ?? '0'} · ${selectedUserPost.runLength ?? 0} days`
                        : 'Organic'}
                    </strong>
                  </div>
                </div>
                {contentTypeRationales[selectedUserPost.contentType] && (
                  <section aria-labelledby="post-rationale-title" className="post-rationale">
                    <h3 id="post-rationale-title">Why this move</h3>
                    <p>{contentTypeRationales[selectedUserPost.contentType]}</p>
                  </section>
                )}
                <PostPerformanceForm
                  key={selectedUserPost.id}
                  performance={selectedUserPost.performance}
                  onSave={(performance) => {
                    setUserPosts((current) => current.map((post) => (
                      post.id === selectedUserPost.id ? { ...post, performance } : post
                    )));
                  }}
                />
                <p className="post-detail-note">Deleting removes this saved post from the calendar. Sample events are not affected.</p>
                <div className="post-form-actions">
                  <button className="cancel-button" onClick={closeSelectedPost} type="button">Keep post</button>
                  <button className="delete-post-button" onClick={handleDeletePost} type="button">Delete post</button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={CalendarSurface} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

