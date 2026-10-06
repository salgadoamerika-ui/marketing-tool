import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarDays, Check, ChevronLeft, ChevronRight, HeartHandshake, Plus, Settings2, X } from 'lucide-react';
import { ActionInsightPopup } from '@/components/action-insight-popup';
import { ErrorBoundary } from '@/components/error-boundary';
import { ConversionGapPanel } from '@/components/conversion-gap-panel';
import { MonthlyAirtimeBars } from '@/components/monthly-airtime-bars';
import {
  BusinessDialog,
  type BusinessSetupInput,
  type BusinessSetupResult,
} from '@/components/business-dialog';
import { PostPerformanceForm, type PostPerformance } from '@/components/post-performance-form';
import { ServiceManager } from '@/components/service-manager';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { buildActionInsight, type ActionInsight, type InsightPost } from '@/lib/action-insight';
import { getBestTimeRecommendation, type BestTimeRecommendation } from '@/lib/best-time';
import { getMonthlyAirtime } from '@/lib/monthly-airtime';
import { buildConversionReview } from '@/lib/conversion-review';
import { getConversionGapMarkers } from '@/lib/conversion-gap';
import { getFlatPostState } from '@/lib/flat-post-ladder';
import { buildPostRationale } from '@/lib/post-rationale';
import { getOverperformer } from '@/lib/overperformer';
import { getBusinessAccent, isBusinessAccent, type BusinessAccent } from '@/lib/business-accents';
import {
  loadServiceSeasonSelections,
  normalizeSeasonMonths,
  serviceSeasonKey,
  serviceSeasonsStorageKey,
} from '@/lib/service-seasons';
import {
  loadServices,
  modeLabel,
  normalizeService,
  serviceCalendarTones,
  servicesStorageKey,
  validateService,
  type ServiceDefinition,
  type ServiceTone,
} from '@/lib/services';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type EventTone = ServiceTone;

function nextServiceTone(usedTones: ServiceTone[]): ServiceTone {
  const used = new Set(usedTones);
  return serviceCalendarTones.find((tone) => !used.has(tone))
    ?? serviceCalendarTones[usedTones.length % serviceCalendarTones.length];
}

type CalendarEvent = {
  day: number;
  project?: string;
  title: string;
  detail?: string;
  tone: EventTone;
  id?: string;
  bestTime?: BestTimeRecommendation;
  conversionGap?: string;
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
  postedTime?: string;
  platforms: Platform[];
  distribution: Distribution;
  schedulingStatus?: 'published' | 'approved-suggestion';
  sourcePostId?: string;
  suggestionKind?: 'automatic' | 'reschedule' | 'trust' | 'offer' | 'repost' | 'fresh-angle' | 'maintenance';
  performance?: PostPerformance;
  budget?: number;
  runLength?: number;
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
  accent: BusinessAccent;
  platforms: Platform[];
  descriptor: string;
  focus: string;
  projects: string[];
  palette: Array<{ label: string; tone: EventTone }>;
  events: Record<string, CalendarEvent[]>;
};

const userPostsStorageKey = 'marketing-tool.user-posts';
const userBusinessesStorageKey = 'marketing-tool.businesses';
const activeBusinessStorageKey = 'marketing-tool.active-business-id';
const platformOptionsStorageKey = 'marketing-tool.platform-options';
const defaultPlatformOptions: Platform[] = ['Facebook', 'Instagram', 'TikTok'];
const contentTypes = ['Announcement', 'Insight', 'Inside look', 'Proof', 'Testimonial', 'Pricing', 'Book now', 'Last chance', 'Recap', 'Promo', 'Fresh angle'];
const sampleBusinesses: Business[] = [
  {
    id: 'mosaic',
    name: 'Mosaic Legal',
    accent: 'rose',
    platforms: [...defaultPlatformOptions],
    descriptor: 'One calm view for every service line.',
    focus: 'Fall programs are carrying the month, with ongoing services kept visible.',
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
        { day: 4, project: 'Tax planning', title: 'Tax planning: common filing errors', detail: 'Post', tone: 'sand' },
        { day: 8, project: 'Immigration', title: 'Immigration: document checklist', detail: 'Inside look', tone: 'blue' },
        { day: 13, project: 'Fall programs', title: 'Fall programs: save the date', detail: 'Announcement', tone: 'rose' },
        { day: 18, project: 'Divorce', title: 'Divorce: first conversation', detail: 'Insight', tone: 'lavender' },
        { day: 25, project: 'Insurance', title: 'Insurance review: what changed?', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 2, project: 'Fall programs', title: 'Fall programs open', detail: 'Announcement', tone: 'rose' },
        { day: 4, project: 'Tax planning', title: 'Tax planning for a new quarter', detail: 'Insight', tone: 'sand' },
        { day: 7, project: 'Divorce', title: 'Divorce: the first practical step', detail: 'Inside look', tone: 'lavender' },
        { day: 9, project: 'Fall programs', title: 'Meet the fall team', detail: 'Inside look', tone: 'rose' },
        { day: 11, project: 'Immigration', title: 'Immigration: what to bring', detail: 'Insight', tone: 'blue' },
        { day: 14, project: 'Insurance', title: 'Insurance review week', detail: 'Book now', tone: 'sage' },
        { day: 16, project: 'Fall programs', title: 'Fall programs: early places', detail: 'Proof', tone: 'blush' },
        { day: 18, project: 'Tax planning', title: 'Tax planning: a cleaner close', detail: 'Book now', tone: 'sand' },
        { day: 21, project: 'Divorce', title: 'Divorce consults, explained', detail: 'Announcement', tone: 'lavender' },
        { day: 23, project: 'Fall programs', title: 'Fall programs: behind the scenes', detail: 'Inside look', tone: 'rose' },
        { day: 25, project: 'Immigration', title: 'Immigration clinic', detail: 'Book now', tone: 'blue' },
        { day: 28, project: 'Insurance', title: 'Insurance questions answered', detail: 'Recap', tone: 'sage' },
        { day: 30, project: 'Fall programs', title: 'Fall programs: last places', detail: 'Closing note', tone: 'blush' },
      ],
      '2026-10': [
        { day: 2, project: 'Fall programs', title: 'Fall programs: final call', detail: 'Announcement', tone: 'rose' },
        { day: 6, project: 'Insurance', title: 'Insurance renewal checklist', detail: 'Insight', tone: 'sage' },
        { day: 10, project: 'Divorce', title: 'Divorce: what happens next', detail: 'Inside look', tone: 'lavender' },
        { day: 15, project: 'Tax planning', title: 'Tax planning before year-end', detail: 'Book now', tone: 'sand' },
        { day: 22, project: 'Immigration', title: 'Immigration Q&A', detail: 'Insight', tone: 'blue' },
        { day: 29, title: 'October service recap', detail: 'Recap', tone: 'muted' },
      ],
    },
  },
  {
    id: 'northline',
    name: 'Northline Financial',
    accent: 'sage',
    platforms: [...defaultPlatformOptions],
    descriptor: 'Keep the useful work in motion.',
    focus: 'Year-end planning is moving forward with useful guidance for prospective clients.',
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
        { day: 6, project: 'Tax planning', title: 'Quarterly planning notes', detail: 'Insight', tone: 'sand' },
        { day: 12, project: 'Fall programs', title: 'Fall programs: early places', detail: 'Proof', tone: 'rose' },
        { day: 20, project: 'Insurance', title: 'Insurance review office hours', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 3, project: 'Fall programs', title: 'Fall programs: planning ahead', detail: 'Announcement', tone: 'rose' },
        { day: 8, project: 'Tax planning', title: 'Tax planning for the final quarter', detail: 'Insight', tone: 'sand' },
        { day: 12, project: 'Insurance', title: 'What an insurance review covers', detail: 'Inside look', tone: 'sage' },
        { day: 17, project: 'Tax planning', title: 'Year-end decisions, made simple', detail: 'Book now', tone: 'sand' },
        { day: 24, project: 'Immigration', title: 'Immigration: the timeline view', detail: 'Inside look', tone: 'blue' },
      ],
      '2026-10': [
        { day: 3, project: 'Tax planning', title: 'Year-end planning begins', detail: 'Announcement', tone: 'sand' },
        { day: 14, project: 'Insurance', title: 'Insurance renewal questions', detail: 'Insight', tone: 'sage' },
        { day: 24, project: 'Tax planning', title: 'Tax planning: final spots', detail: 'Book now', tone: 'sand' },
      ],
    },
  },
  {
    id: 'harbor',
    name: 'Harbor Coverage',
    accent: 'amber',
    platforms: [...defaultPlatformOptions],
    descriptor: 'Useful guidance for the people you serve.',
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
        { day: 5, project: 'Insurance', title: 'Insurance review: a reset', detail: 'Announcement', tone: 'sage' },
        { day: 19, project: 'Insurance', title: 'The coverage check-in', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 1, project: 'Insurance', title: 'Insurance review week', detail: 'Announcement', tone: 'sage' },
        { day: 6, project: 'Insurance', title: 'Three questions to ask now', detail: 'Insight', tone: 'sage' },
        { day: 15, project: 'Tax planning', title: 'Tax planning: the early look', detail: 'Inside look', tone: 'sand' },
        { day: 20, project: 'Insurance', title: 'Coverage stories from the field', detail: 'Proof', tone: 'blush' },
        { day: 26, project: 'Immigration', title: 'Immigration support, explained', detail: 'Insight', tone: 'blue' },
      ],
      '2026-10': [
        { day: 7, project: 'Insurance', title: 'Renewal season, without the rush', detail: 'Inside look', tone: 'sage' },
        { day: 16, project: 'Insurance', title: 'Insurance review office hours', detail: 'Book now', tone: 'sage' },
        { day: 27, title: 'October questions, answered', detail: 'Recap', tone: 'muted' },
      ],
    },
  },
];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const seededCalendarPosts: InsightPost[] = sampleBusinesses.flatMap((business) =>
  Object.entries(business.events).flatMap(([month, events]) =>
    events.filter((event) => event.project).map((event, index) => ({
      id: `seed-${business.id}-${month}-${index}`,
      businessId: business.id, project: event.project!, title: event.title,
      contentType: event.detail ?? 'Post', date: `${month}-${String(event.day).padStart(2, '0')}`,
    }))));
const seededCalendarDates = Object.fromEntries(sampleBusinesses.map((business) => [
  business.id,
  Object.entries(business.events).flatMap(([month, events]) =>
    events.map((event) => `${month}-${String(event.day).padStart(2, '0')}`)),
]));
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function createBusinessWorkspace(
  id: string,
  name: string,
  accent: BusinessAccent = 'rose',
  platforms: Platform[] = defaultPlatformOptions,
  firstServiceName?: string,
): Business {
  const tone = getBusinessAccent(accent).tone;
  return {
    id,
    name,
    accent,
    platforms: [...platforms],
    descriptor: 'A separate workspace for this business.',
    focus: firstServiceName ? 'A fresh calendar for your first Service or Campaign.' : 'Add a Service or Campaign to begin building this calendar.',
    projects: firstServiceName ? [firstServiceName] : [],
    palette: firstServiceName ? [{ label: firstServiceName, tone }] : [],
    events: {},
  };
}

function readUserBusinesses(): Business[] {
  if (typeof window === 'undefined') return [];

  try {
    const serialized = window.localStorage.getItem(userBusinessesStorageKey);
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) throw new Error('Saved businesses are not a list.');

    const ids = new Set(sampleBusinesses.map((business) => business.id));
    const names = new Set(sampleBusinesses.map((business) => business.name.toLowerCase()));
    return parsed.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error('A saved business entry is invalid.');
      }
      const { id, name, accent, platforms } = entry as {
        id?: unknown;
        name?: unknown;
        accent?: unknown;
        platforms?: unknown;
      };
      if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) {
        throw new Error('A saved business is missing its name or identifier.');
      }
      if (platforms !== undefined && (!Array.isArray(platforms) || platforms.some((platform) => typeof platform !== 'string'))) {
        throw new Error('A saved business has invalid platform selections.');
      }
      if (accent !== undefined && !isBusinessAccent(accent)) {
        throw new Error('A saved business has an invalid tab accent.');
      }
      const cleanName = name.trim();
      if (ids.has(id) || names.has(cleanName.toLowerCase())) {
        throw new Error('Saved businesses contain a duplicate name or identifier.');
      }
      ids.add(id);
      names.add(cleanName.toLowerCase());
      const savedPlatforms = Array.isArray(platforms)
        ? [...new Set(platforms.map((platform) => platform.trim()).filter(Boolean))]
        : [...defaultPlatformOptions];
      if (savedPlatforms.length === 0) throw new Error('A saved business needs at least one platform.');
      return createBusinessWorkspace(
        id,
        cleanName,
        accent === undefined ? 'rose' : accent,
        savedPlatforms,
      );
    });
  } catch (error) {
    console.warn('Saved businesses could not be loaded.', error);
    return [];
  }
}

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

function createPostForm(date: string, platforms: Platform[] = []): PostForm {
  return {
    project: '',
    contentType: '',
    title: '',
    date,
    platforms: [...platforms],
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
      && (post.postedTime === undefined
        || (typeof post.postedTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(post.postedTime)))
      && (post.schedulingStatus === undefined
        || post.schedulingStatus === 'published'
        || post.schedulingStatus === 'approved-suggestion')
      && (post.sourcePostId === undefined || typeof post.sourcePostId === 'string')
      && (post.performance === undefined || isPostPerformance(post.performance))
      && Array.isArray(post.platforms)
      && post.platforms.every((platform) => typeof platform === 'string' && platform.trim().length > 0)
      && (post.distribution === 'organic' || post.distribution === 'paid'),
  );
}

function isPostPerformance(value: unknown): value is PostPerformance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const performance = value as Partial<PostPerformance>;
  return (['views', 'saves', 'bookings'] as const).every((metric) => {
    const count = performance[metric];
    return count === undefined || (
      typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
    );
  });
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
  const [userBusinesses, setUserBusinesses] = useState<Business[]>(readUserBusinesses);
  const businesses = useMemo(() => [...sampleBusinesses, ...userBusinesses], [userBusinesses]);
  const [activeBusinessId, setActiveBusinessId] = useState(() => {
    const savedBusinessId = window.localStorage.getItem(activeBusinessStorageKey);
    return savedBusinessId && businesses.some((item) => item.id === savedBusinessId)
      ? savedBusinessId
      : sampleBusinesses[0].id;
  });
  const [todayKey, setTodayKey] = useState(() => formatDateInput(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 8, 1));
  const [statusMessage, setStatusMessage] = useState('');
  const [userPosts, setUserPosts] = useState<UserPost[]>(readUserPosts);
  const [services, setServices] = useState<ServiceDefinition[]>(() => {
    const defaults: ServiceDefinition[] = [
      ...sampleBusinesses.flatMap((business) => business.projects.map((name) => ({
        id: `${business.id}:${name}`, businessId: business.id, name, mode: 'evergreen' as const,
      }))),
      ...userPosts.map((post) => ({
        id: `${post.businessId}:${post.project}`, businessId: post.businessId, name: post.project, mode: 'evergreen' as const,
      })),
    ];
    return loadServices(window.localStorage.getItem(servicesStorageKey), defaults);
  });
  const [seasonMonthsByService, setSeasonMonthsByService] = useState(() =>
    loadServiceSeasonSelections(window.localStorage.getItem(serviceSeasonsStorageKey)));
  const [isServiceManagerOpen, setIsServiceManagerOpen] = useState(false);
  const [isBusinessDialogOpen, setIsBusinessDialogOpen] = useState(false);
  const [isPostFormOpen, setIsPostFormOpen] = useState(false);
  const [postForm, setPostForm] = useState<PostForm>(() => createPostForm(formatDateInput(new Date())));
  const [formError, setFormError] = useState('');
  const [actionInsight, setActionInsight] = useState<ActionInsight | null>(null);
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>(readAvailablePlatforms);
  const [isAddingPlatform, setIsAddingPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [platformError, setPlatformError] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const business = businesses.find((item) => item.id === activeBusinessId) ?? businesses[0];
  const activeServices = useMemo(
    () => services.filter((service) => service.businessId === business.id),
    [services, business.id],
  );
  const activeBusiness = useMemo(() => ({
    ...business,
    projects: activeServices.map((service) => service.name),
    palette: activeServices.map((service) => ({
      label: service.name,
      tone: service.tone ?? business.palette.find((item) => item.label === service.name)?.tone ?? 'muted' as EventTone,
    })),
  }), [business, activeServices]);
  const days = useMemo(() => makeCalendarDays(visibleMonth), [visibleMonth]);
  const events = activeBusiness.events[monthKey(visibleMonth)] ?? [];
  const activeBusinessPosts = useMemo(
    () => userPosts.filter((post) => post.businessId === activeBusiness.id),
    [userPosts, activeBusiness.id],
  );
  const activeSeededCalendarPosts = useMemo(
    () => seededCalendarPosts.filter((post) => post.businessId === activeBusiness.id),
    [activeBusiness.id],
  );
  const monthPosts = activeBusinessPosts.filter((post) => post.date.startsWith(monthKey(visibleMonth)));
  const monthlyAirtime = getMonthlyAirtime(
    activeBusiness.id,
    activeBusiness.projects,
    [
      ...activeBusinessPosts,
      ...events.filter((event) => event.project).map((event, index) => ({
        id: `calendar-${monthKey(visibleMonth)}-${index}`,
        businessId: activeBusiness.id,
        project: event.project!,
        date: `${monthKey(visibleMonth)}-${String(event.day).padStart(2, '0')}`,
      })),
    ],
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
  );
  const selectedUserPost = userPosts.find(
    (post) => post.id === selectedPostId && post.businessId === activeBusiness.id,
  );
  const selectedService = activeServices.find((service) => service.name === selectedUserPost?.project);
  const conversionMarkers = useMemo(
    () => getConversionGapMarkers(activeBusinessPosts),
    [activeBusinessPosts],
  );
  const conversionReview = selectedUserPost ? buildConversionReview(
    selectedUserPost,
    [...activeBusinessPosts, ...activeSeededCalendarPosts],
    formatDateInput(new Date()),
    seededCalendarDates[activeBusiness.id] ?? [],
    activeServices,
  ) : null;
  const selectedBestTime = selectedUserPost?.schedulingStatus === 'approved-suggestion'
    ? getBestTimeRecommendation(
      selectedUserPost.businessId,
      selectedUserPost.project,
      selectedUserPost.platforms,
      activeBusinessPosts,
    )
    : null;
  const postAsEvent = (post: UserPost): CalendarEvent => ({
    id: post.id,
    day: Number(post.date.slice(-2)),
    title: post.title,
    detail: getPostDetail(post),
    tone: getPostTone(post.project, activeBusiness),
    ...(conversionMarkers.has(post.id) ? { conversionGap: post.project } : {}),
    ...(post.schedulingStatus === 'approved-suggestion'
      ? { bestTime: getBestTimeRecommendation(post.businessId, post.project, post.platforms, activeBusinessPosts) }
      : {}),
  });
  const calendarEvents = [
    ...events,
    ...monthPosts.map(postAsEvent),
  ];
  useEffect(() => {
    const refreshDay = () => setTodayKey(formatDateInput(new Date()));
    const timer = window.setInterval(refreshDay, 60_000);
    window.addEventListener('focus', refreshDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDay);
    };
  }, []);
  useEffect(() => {
    window.localStorage.setItem(
      userBusinessesStorageKey,
      JSON.stringify(userBusinesses.map(({ id, name, accent, platforms }) => ({ id, name, accent, platforms }))),
    );
  }, [userBusinesses]);
  useEffect(() => {
    window.localStorage.setItem(activeBusinessStorageKey, activeBusinessId);
  }, [activeBusinessId]);
  useEffect(() => {
    setActionInsight((current) => {
      if (!current?.sourcePostId) return current;
      const source = activeBusinessPosts.find((post) => post.id === current.sourcePostId);
      if (!source || source.businessId !== activeBusiness.id) return null;
      const refreshed = buildActionInsight(
        current.action,
        source,
        [...activeBusinessPosts, ...activeSeededCalendarPosts],
        todayKey,
        seededCalendarDates[activeBusiness.id] ?? [],
        activeServices,
      );
      return JSON.stringify(current) === JSON.stringify(refreshed) ? current : refreshed;
    });
  }, [activeBusiness.id, activeBusinessPosts, activeSeededCalendarPosts, activeServices, todayKey]);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(services);
      if (window.localStorage.getItem(servicesStorageKey) !== serialized) {
        window.localStorage.setItem(servicesStorageKey, serialized);
      }
    } catch {
      setStatusMessage('Service information could not be saved on this device.');
    }
  }, [services]);

  const handleSaveService = (draft: ServiceDefinition): string | ServiceDefinition => {
    const error = validateService(draft);
    if (error) return error;
    if (draft.businessId !== activeBusiness.id) return 'Choose a service in this business.';
    const existing = services.find((service) => service.id === draft.id);
    if (existing && (existing.businessId !== draft.businessId || existing.name !== draft.name.trim())) {
      return 'The existing service name cannot be changed here.';
    }
    if (services.some((service) => service.id !== draft.id && service.businessId === draft.businessId
      && service.name.toLowerCase() === draft.name.trim().toLowerCase())) return 'That name is already used in this business.';
    const requestedPlatforms = draft.platforms ?? existing?.platforms ?? activeBusiness.platforms;
    const platforms = [...new Set(requestedPlatforms.filter((platform) => availablePlatforms.includes(platform)))];
    if (platforms.length === 0) return 'Choose at least one available platform for this service or campaign.';
    const existingTone = activeBusiness.palette.find((item) => item.label === draft.name.trim())?.tone;
    const tone = existing?.tone ?? existingTone ?? nextServiceTone(activeBusiness.palette.map((item) => item.tone));
    const saved = normalizeService({ ...draft, name: draft.name.trim(), platforms, tone });
    const updated = existing ? services.map((service) => service.id === saved.id ? saved : service) : [...services, saved];
    try {
      window.localStorage.setItem(servicesStorageKey, JSON.stringify(updated));
    } catch {
      return 'This device could not save the change. Free some storage and try again.';
    }
    setServices(updated);
    return saved;
  };

  const handleSaveSeasonMonths = (service: string, months: number[]): string | undefined => {
    const validService = activeBusiness.projects.includes(service);
    if (!validService) return 'This service is no longer available in this business.';
    let normalized: number[];
    try {
      normalized = normalizeSeasonMonths(months);
    } catch (error) {
      return error instanceof Error ? error.message : 'Choose valid months for this service.';
    }
    const key = serviceSeasonKey(activeBusiness.id, service);
    const updated = { ...seasonMonthsByService, [key]: normalized };
    try {
      window.localStorage.setItem(serviceSeasonsStorageKey, JSON.stringify(updated));
    } catch {
      return 'This device could not save the season settings. Free some storage and try again.';
    }
    setSeasonMonthsByService(updated);
    return undefined;
  };

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
    setPostForm(createPostForm(defaultPostDate(visibleMonth), activeBusiness.platforms));
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

  const selectPostService = (project: string) => {
    const service = activeServices.find((item) => item.name === project);
    const preferredPlatforms = service?.platforms ?? activeBusiness.platforms;
    setPostForm((current) => ({
      ...current,
      project,
      platforms: preferredPlatforms.filter((platform) => availablePlatforms.includes(platform)),
    }));
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
      schedulingStatus: 'published',
      ...(postForm.distribution === 'paid' ? { budget, runLength } : {}),
    };

    const postsAfterSave = [...userPosts, savedPost];
    setUserPosts(postsAfterSave);
    setActionInsight(buildActionInsight(
      'logged',
      savedPost,
      [...postsAfterSave.filter((post) => post.businessId === activeBusiness.id), ...activeSeededCalendarPosts],
      todayKey,
      seededCalendarDates[activeBusiness.id] ?? [],
      activeServices,
    ));
    setVisibleMonth(new Date(`${savedPost.date}T12:00:00`));
    closePostForm();
    showActionMessage(`Added “${savedPost.title}” to the calendar.`);
  };

  const handleAddInsightSuggestions = () => {
    if (!actionInsight) return;

    const source = activeBusinessPosts.find((post) => post.id === (actionInsight.sourcePostId ?? actionInsight.proposals[0]?.triggerPostId));
    if (!source || source.businessId !== activeBusiness.id) {
      setActionInsight(null);
      return;
    }
    const refreshed = buildActionInsight(actionInsight.action, source, [...activeBusinessPosts, ...activeSeededCalendarPosts],
      formatDateInput(new Date()), seededCalendarDates[activeBusiness.id] ?? [], activeServices);
    if (JSON.stringify(refreshed.proposals) !== JSON.stringify(actionInsight.proposals)) {
      setActionInsight(refreshed);
      showActionMessage('The calendar or Campaign dates changed. Review the refreshed suggestions before adding.');
      return;
    }
    const suggestions = refreshed.proposals.flatMap((proposal): UserPost[] => {
      const sourcePost = activeBusinessPosts.find((post) => post.id === proposal.sourcePostId);
      if (!sourcePost) return [];
      const original = proposal.replaces
        ? activeBusinessPosts.find((post) => post.id === proposal.replaces!.postId)
        : undefined;
      return [{
        ...original,
        id: original?.id ?? createPostId(),
        businessId: sourcePost.businessId,
        project: sourcePost.project,
        contentType: proposal.contentType,
        title: proposal.title,
        date: proposal.date,
        platforms: original?.platforms ?? sourcePost.platforms,
        distribution: original?.distribution ?? 'organic',
        schedulingStatus: 'approved-suggestion',
        sourcePostId: proposal.sourcePostId,
        suggestionKind: proposal.kind,
      }];
    });

    if (suggestions.length > 0) {
      const replacementIds = new Set(refreshed.proposals.flatMap((proposal) => proposal.replaces ? [proposal.replaces.postId] : []));
      setUserPosts((current) => {
        const revised = current.map((existing) => replacementIds.has(existing.id)
          ? suggestions.find((suggestion) => suggestion.id === existing.id) ?? existing : existing);
        return [...revised, ...suggestions.filter((suggestion) => !replacementIds.has(suggestion.id)
          && !revised.some((existing) => existing.schedulingStatus === 'approved-suggestion'
            && existing.sourcePostId === suggestion.sourcePostId && existing.contentType === suggestion.contentType
            && existing.date === suggestion.date))];
      });
      setSelectedPostId(null);
      setVisibleMonth(new Date(`${suggestions[0].date}T12:00:00`));
      showActionMessage(`${suggestions.length} suggested ${suggestions.length === 1 ? 'change was' : 'changes were'} applied to the calendar.`);
    }
    setActionInsight(null);
  };

  const handleDeletePost = () => {
    if (!selectedUserPost) return;

    setUserPosts((current) => current.filter((post) => post.id !== selectedUserPost.id));
    setActionInsight(null);
    setSelectedPostId(null);
    showActionMessage(`Deleted “${selectedUserPost.title}” from the calendar.`);
  };

  const handleSaveResults = (performance: PostPerformance, postedTime?: string) => {
    if (!selectedUserPost) return;

    const postsAfterSave = userPosts.map((post) =>
      post.id === selectedUserPost.id
        ? { ...post, performance, postedTime: postedTime || undefined }
        : post
    );
    setUserPosts(postsAfterSave);
    const savedPost = postsAfterSave.find((post) => post.id === selectedUserPost.id)!;
    const businessPostsAfterSave = postsAfterSave.filter((post) => post.businessId === activeBusiness.id);
    const flatState = getFlatPostState(savedPost, businessPostsAfterSave, todayKey);
    const service = activeServices.find((item) => item.name === savedPost.project);
    const winner = getOverperformer(savedPost, businessPostsAfterSave.filter((post) => (post as InsightPost).status !== 'skipped' && post.date <= todayKey));
    setActionInsight((flatState.action !== 'none' && flatState.latestPostId === savedPost.id) || winner || service?.mode === 'campaign'
      ? buildActionInsight('results', savedPost, [...businessPostsAfterSave, ...activeSeededCalendarPosts], todayKey, seededCalendarDates[activeBusiness.id] ?? [], activeServices)
      : null);
    // Keep results open so the conversion assessment (including unmet gates)
    // is visible immediately, independently of content-sequence suggestions.
  };

  const handleAddConversionSuggestion = () => {
    if (!selectedUserPost) return;
    const refreshed = buildConversionReview(selectedUserPost, [...activeBusinessPosts, ...activeSeededCalendarPosts],
      formatDateInput(new Date()), seededCalendarDates[activeBusiness.id] ?? [], activeServices);
    const proposal = refreshed.proposal;
    if (!proposal || proposal.blocked) {
      showActionMessage('There is no eligible follow-up date. A closed Campaign cannot add new suggestions.');
      return;
    }
    if (JSON.stringify(proposal) !== JSON.stringify(conversionReview?.proposal)) {
      showActionMessage('The calendar or Campaign dates changed. Review the updated follow-up before adding.');
      return;
    }
    const source = activeBusinessPosts.find((post) => post.id === proposal.sourcePostId);
    if (!source) return;
    const suggestion: UserPost = {
      id: createPostId(),
      businessId: source.businessId,
      project: source.project,
      contentType: proposal.contentType,
      title: proposal.title,
      date: proposal.date,
      platforms: source.platforms,
      distribution: 'organic',
      schedulingStatus: 'approved-suggestion',
      suggestionKind: proposal.kind,
      sourcePostId: proposal.sourcePostId,
    };
    setUserPosts((current) => current.some((existing) =>
      existing.sourcePostId === suggestion.sourcePostId && existing.suggestionKind === suggestion.suggestionKind)
      ? current : [...current, suggestion]);
    setActionInsight(null);
    setSelectedPostId(null);
    setVisibleMonth(new Date(`${suggestion.date}T12:00:00`));
    showActionMessage(`Added “${suggestion.title}” to the calendar.`);
  };

  const handleCreateBusiness = (input: BusinessSetupInput): BusinessSetupResult => {
    const name = input.name.trim();
    if (!name) return { error: 'Enter a name for this business.' };
    if (businesses.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'A business with that name already exists.' };
    }
    if (!isBusinessAccent(input.accent)) return { error: 'Choose a tab accent.' };
    const serviceName = input.serviceName.trim();
    const selectedPlatforms = [...new Set(input.platforms.filter((platform) => availablePlatforms.includes(platform)))];
    if (selectedPlatforms.length === 0) return { error: 'Choose at least one available platform.' };

    const businessId = `business-${createPostId()}`;
    const serviceTone = getBusinessAccent(input.accent).tone;
    const service: ServiceDefinition = input.mode === 'campaign'
      ? {
        id: `${businessId}:first-service`,
        businessId,
        name: serviceName,
        mode: 'campaign',
        startDate: input.startDate,
        endDate: input.deadline,
        platforms: selectedPlatforms,
        tone: serviceTone,
      }
      : {
        id: `${businessId}:first-service`,
        businessId,
        name: serviceName,
        mode: 'evergreen',
        platforms: selectedPlatforms,
        tone: serviceTone,
      };
    const serviceError = validateService(service);
    if (serviceError) return { error: serviceError };

    const newBusiness = createBusinessWorkspace(
      businessId,
      name,
      input.accent,
      selectedPlatforms,
      service.name,
    );
    const nextBusinesses = [...userBusinesses, newBusiness];
    const nextServices = [...services, service];
    const serializedBusinesses = JSON.stringify(nextBusinesses.map(({ id, name: businessName, accent, platforms }) => ({
      id, name: businessName, accent, platforms,
    })));
    let previousBusinesses: string | null = null;
    let wroteBusinesses = false;
    try {
      previousBusinesses = window.localStorage.getItem(userBusinessesStorageKey);
      window.localStorage.setItem(userBusinessesStorageKey, serializedBusinesses);
      wroteBusinesses = true;
      window.localStorage.setItem(servicesStorageKey, JSON.stringify(nextServices));
    } catch {
      if (wroteBusinesses) {
        try {
          if (previousBusinesses === null) window.localStorage.removeItem(userBusinessesStorageKey);
          else window.localStorage.setItem(userBusinessesStorageKey, previousBusinesses);
        } catch {
          // Keep the original save error visible if the storage device is full.
        }
      }
      return { error: 'This business and its first Service or Campaign could not be saved on this device.' };
    }

    setUserBusinesses(nextBusinesses);
    setServices(nextServices);
    return {
      business: {
        id: newBusiness.id,
        name: newBusiness.name,
        accent: newBusiness.accent,
        service,
        platforms: selectedPlatforms,
      },
    };
  };

  const handleOpenCreatedBusiness = (businessId: string) => {
    if (!userBusinesses.some((business) => business.id === businessId)) return;
    setActiveBusinessId(businessId);
    setVisibleMonth(new Date(`${todayKey}T12:00:00`));
    setStatusMessage('');
    setActionInsight(null);
    setSelectedPostId(null);
    closePostForm();
    setIsServiceManagerOpen(false);
    setIsBusinessDialogOpen(false);
  };

  return (
    <main className="calendar-page">
      <div className="calendar-shell">
        <nav className="business-tabs" aria-label="Businesses">
          {businesses.map((business) => (
            <button
              aria-pressed={business.id === activeBusiness.id}
              className={`business-tab ${business.id === activeBusiness.id ? 'active' : ''}`}
              key={business.id}
              style={{ '--business-accent-color': getBusinessAccent(business.accent).color } as CSSProperties}
              onClick={() => {
                setActiveBusinessId(business.id);
                setStatusMessage('');
                setActionInsight(null);
                closeSelectedPost();
                closePostForm();
                setIsServiceManagerOpen(false);
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
            onClick={() => {
              setActionInsight(null);
              closeSelectedPost();
              closePostForm();
              setIsBusinessDialogOpen(true);
            }}
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
            <button className="icon-button manage-services" onClick={() => setIsServiceManagerOpen(true)} type="button">
              <Settings2 size={15} strokeWidth={1.8} aria-hidden="true" />
              Manage services
            </button>
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
                            {event.conversionGap && (
                              <span className="event-conversion-gap" role="img"
                                aria-label={`Conversion gap for ${event.conversionGap}`}
                                title="Conversion gap across the latest 3 posts. Open for the summary.">
                                <HeartHandshake size={13} strokeWidth={1.8} aria-hidden="true" />
                              </span>
                            )}
                            {event.bestTime && (
                              <span
                                aria-label={`${event.bestTime.label}. ${event.bestTime.detail}`}
                                className={`event-best-time event-best-time-${event.bestTime.mode}`}
                                title={`${event.bestTime.label}. ${event.bestTime.detail}`}
                              >
                                {event.bestTime.compactLabel}
                              </span>
                            )}
                          </>
                        );

                        return event.id ? (
                          <button
                            aria-label={`Open saved post: ${event.title}${event.conversionGap ? '. Conversion gap — open for summary' : ''}${event.bestTime ? `. ${event.bestTime.label}. ${event.bestTime.detail}` : ''}`}
                            className={`event-chip event-chip-button event-${event.tone}`}
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
              <MonthlyAirtimeBars
                rows={monthlyAirtime}
                businessId={activeBusiness.id}
                getTone={(service) => getPostTone(service, activeBusiness)}
                month={visibleMonth.getMonth() + 1}
                seasonMonthsByService={seasonMonthsByService}
                onSaveSeasonMonths={handleSaveSeasonMonths}
              />
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

        {isServiceManagerOpen && (
          <ServiceManager
            services={activeServices}
            businessId={activeBusiness.id}
            businessName={activeBusiness.name}
            platformOptions={availablePlatforms}
            defaultPlatforms={activeBusiness.platforms}
            onSave={handleSaveService}
            onClose={() => setIsServiceManagerOpen(false)}
          />
        )}
        {isBusinessDialogOpen && (
          <BusinessDialog
            platformOptions={availablePlatforms}
            onCreate={handleCreateBusiness}
            onOpenBusiness={handleOpenCreatedBusiness}
            onClose={() => setIsBusinessDialogOpen(false)}
          />
        )}
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
                      onChange={(event) => selectPostService(event.target.value)}
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
                {selectedBestTime && (
                  <section
                    aria-label="Best time recommendation"
                    className={`post-best-time post-best-time-${selectedBestTime.mode}`}
                  >
                    <span className="post-best-time-label">{selectedBestTime.label}</span>
                    <p>{selectedBestTime.detail}</p>
                  </section>
                )}
                <div className="post-detail-list">
                  {selectedService && <div>
                    <span>Mode</span>
                    <strong>{modeLabel(selectedService.mode)}</strong>
                  </div>}
                  {selectedService?.mode === 'campaign' && (
                    <div>
                      <span>Deadline</span>
                      <strong>{formatPostDate(selectedService.endDate)}</strong>
                    </div>
                  )}
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
                <PostPerformanceForm
                  key={selectedUserPost.id}
                  performance={selectedUserPost.performance}
                  postedTime={selectedUserPost.postedTime}
                  onSave={handleSaveResults}
                />
                {conversionReview?.assessment.status === 'detected' && conversionMarkers.has(selectedUserPost.id) && (
                  <ConversionGapPanel
                    key={`${JSON.stringify(conversionReview.assessment.result)}-${conversionReview.stage}`}
                    review={conversionReview}
                    onAdd={handleAddConversionSuggestion}
                  />
                )}
                <section aria-labelledby="post-rationale-title" className="post-rationale">
                  <h3 id="post-rationale-title">Why this move</h3>
                  <p>{buildPostRationale(
                    selectedUserPost,
                    [...activeBusinessPosts, ...activeSeededCalendarPosts],
                    todayKey,
                    activeServices,
                  )}</p>
                </section>
                <p className="post-detail-note">Deleting removes this saved post from the calendar. Sample events are not affected.</p>
                <div className="post-form-actions">
                  <button className="cancel-button" onClick={closeSelectedPost} type="button">Keep post</button>
                  <button className="save-post-button" onClick={() => {
                    setActionInsight(buildActionInsight('completed', selectedUserPost,
                      [...activeBusinessPosts, ...activeSeededCalendarPosts],
                      formatDateInput(new Date()),
                      seededCalendarDates[activeBusiness.id] ?? [],
                      activeServices));
                    closeSelectedPost();
                  }} type="button">Suggest next posts</button>
                  <button className="delete-post-button" onClick={handleDeletePost} type="button">Delete post</button>
                </div>
              </div>
            </section>
          </div>
        )}
        {actionInsight && (
          <ActionInsightPopup
            insight={actionInsight}
            onAdd={handleAddInsightSuggestions}
            onSkip={() => setActionInsight(null)}
          />
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

