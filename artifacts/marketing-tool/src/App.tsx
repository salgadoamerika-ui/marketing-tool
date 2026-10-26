import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarDays, Check, ChevronLeft, ChevronRight, HeartHandshake, Plus, Settings2, X } from 'lucide-react';
import { ActionInsightPopup } from '@/components/action-insight-popup';
import { NotificationCenter } from '@/components/notification-center';
import { WelcomeEntry } from '@/components/welcome-entry';
import { FirstRunSetup } from '@/components/first-run-setup';
import { useFirstRun } from '@/components/first-run-context';
import { BusinessManager } from '@/components/business-manager';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
} from '@/components/ui/context-menu';
import {
  businessOverridesStorageKey, loadBusinessOverrides, validateBusinessName,
  withoutBusiness, withoutBusinessSettings, withoutBusinessSeasons,
} from '@/lib/business-management';
import { firstRunStorageKey, validateFirstRun, type FirstRunSetupInput } from '@/lib/first-run';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import { performanceAttentionKey } from '@/lib/notification-sound';
import { currentDateInput } from '@/lib/current-date';
import { CampaignWakeupBanner } from '@/components/campaign-wakeup-banner';
import { ErrorBoundary } from '@/components/error-boundary';
import { ConversionGapPanel } from '@/components/conversion-gap-panel';
import { MonthlyAirtimeBars } from '@/components/monthly-airtime-bars';
import {
  BusinessDialog,
  type BusinessSetupInput,
  type BusinessSetupResult,
} from '@/components/business-dialog';
import { BusinessContentManager } from '@/components/business-content-manager';
import { PostPerformanceForm, type PostPerformance } from '@/components/post-performance-form';
import { ServiceManager } from '@/components/service-manager';
import {
  WeekCalendarView,
  type MidCampaignCheckIn,
  type WeekCalendarItem,
} from '@/components/week-calendar-view';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  buildActionInsight,
  buildSequenceActionInsight,
  type ActionInsight,
  type InsightAction,
  type InsightPost,
} from '@/lib/action-insight';
import { getBestTimeRecommendation, type BestTimeRecommendation } from '@/lib/best-time';
import { getMonthlyAirtime } from '@/lib/monthly-airtime';
import { buildConversionReview } from '@/lib/conversion-review';
import { getConversionGapMarkers } from '@/lib/conversion-gap';
import { getFlatPostState } from '@/lib/flat-post-ladder';
import { buildFlatPostInsight } from '@/lib/flat-post-suggestions';
import { buildSkipAlternativeInsight } from '@/lib/skip-alternative';
import { buildPostRationale } from '@/lib/post-rationale';
import { getOverperformer } from '@/lib/overperformer';
import {
  bestCampaignLearningPost,
  campaignNameForCycle,
  handledWakeCycle,
  isCampaignWakeCycleOpen,
  nextCampaignWakeCycle,
} from '@/lib/campaign-wakeups';
import {
  insightNotificationKey,
  notificationsStorageKey,
  parseNotifications,
  type AppNotification,
} from '@/lib/notifications';
import { getBusinessAccent, isBusinessAccent, type BusinessAccent } from '@/lib/business-accents';
import {
  createBusinessContentSettings,
  defaultContentTypes,
  defaultPlatformOptions,
  deleteContentTypeAliases,
  loadBusinessContentSettings,
  renameContentTypeAliases,
  type BusinessContentSettings,
} from '@/lib/business-content-settings';
import {
  loadServiceSeasonSelections,
  normalizeSeasonMonths,
  serviceSeasonKey,
  serviceSeasonsStorageKey,
} from '@/lib/service-seasons';
import {
  markExpiredCampaignsDormant,
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

import { initializeLegacyWorkspace, legacyBusinessIdentities, legacySampleServiceIds } from '@/lib/legacy-workspace';

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
  contentTypeName?: string;
  id?: string;
  bestTime?: BestTimeRecommendation;
  conversionGap?: string;
  isCompleted?: boolean;
  isSkipped?: boolean;
};

type Distribution = 'organic' | 'paid';
type Platform = string;
type ContentCatalogKind = 'content type' | 'platform';
type ContentCatalogOperation = 'add' | 'rename' | 'delete';

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
  suggestionKind?: 'automatic' | 'reschedule' | 'trust' | 'offer' | 'repost' | 'fresh-angle' | 'maintenance' | 'skip-alternative';
  performance?: PostPerformance;
  isCompleted?: boolean;
  status?: 'completed' | 'skipped';
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
};

const userPostsStorageKey = 'marketing-tool.user-posts';
const userBusinessesStorageKey = 'marketing-tool.businesses';
const activeBusinessStorageKey = 'marketing-tool.active-business-id';
const platformOptionsStorageKey = 'marketing-tool.platform-options';
const businessContentSettingsStorageKey = 'marketing-tool.business-content-settings';
const emptyWorkspace: Business = {
  id: 'empty-workspace', name: 'Your workspace', accent: 'rose',
  platforms: [...defaultPlatformOptions], descriptor: 'A fresh start',
  focus: 'Add your first business when you’re ready.', projects: [], palette: [],
};
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
  };
}

function readUserBusinesses(): Business[] {
  if (typeof window === 'undefined') return [];

  try {
    const serialized = window.localStorage.getItem(userBusinessesStorageKey);
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) throw new Error('Saved businesses are not a list.');

    const ids = new Set<string>();
    const names = new Set<string>();
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

function mondayStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function shiftCalendarDays(date: Date, amount: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
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

function readBusinessContentSettings(businesses: Business[]) {
  return loadBusinessContentSettings(
    window.localStorage.getItem(businessContentSettingsStorageKey),
    businesses,
    readAvailablePlatforms(),
  );
}

function writeLocalStorageBatch(entries: Array<[string, string]>) {
  const previous = entries.map(([key]) => [key, window.localStorage.getItem(key)] as const);
  try {
    entries.forEach(([key, value]) => window.localStorage.setItem(key, value));
  } catch (error) {
    previous.forEach(([key, value]) => {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // Preserve the original storage error.
      }
    });
    throw error;
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
      && (post.isCompleted === undefined || typeof post.isCompleted === 'boolean')
      && (post.status === undefined || post.status === 'completed' || post.status === 'skipped')
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
  return [post.contentType, channelText, distributionText].filter(Boolean).join(' · ');
}

function getContentTypeStyle(name: string): CSSProperties {
  let hash = 2166136261;
  for (const character of name) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return { '--content-type-hue': String((hash >>> 0) % 360) } as CSSProperties;
}

function restrictInsightToAvailableTypes(
  insight: ActionInsight,
  availableTypes: string[],
): ActionInsight {
  const beats = insight.beats.filter((beat) => availableTypes.includes(beat.contentType));
  const proposals = insight.proposals.filter((proposal) => availableTypes.includes(proposal.contentType));
  if (beats.length === insight.beats.length && proposals.length === insight.proposals.length) return insight;
  return {
    ...insight,
    beats,
    proposals,
    title: proposals.length
      ? proposals.length === 1 ? `${proposals[0].contentType} is next in the sequence` : 'Next available moves'
      : 'No available follow-up type',
    recommendation: proposals.length
      ? 'Some sequence steps were skipped because their content types are not enabled for this business.'
      : 'No follow-up was added because this business does not have the required content types. Add a type in Manage content if you want to use it.',
  };
}

function buildBusinessActionInsight(
  action: InsightAction,
  post: InsightPost,
  posts: InsightPost[],
  today: string,
  occupiedDates: string[],
  services: ServiceDefinition[],
  availableTypes: string[],
  sequenceOnly = false,
  sequenceAnchorDate?: string,
): ActionInsight {
  if (action === 'skipped' || post.status === 'skipped') {
    return buildSkipAlternativeInsight(post, posts, today, occupiedDates, services, availableTypes);
  }
  return restrictInsightToAvailableTypes(
    sequenceOnly
      ? buildSequenceActionInsight(action, post, posts, today, occupiedDates, services, sequenceAnchorDate)
      : buildActionInsight(action, post, posts, today, occupiedDates, services),
    availableTypes,
  );
}

function getCompletionPerformanceInsight(
  post: InsightPost,
  posts: InsightPost[],
  today: string,
  occupiedDates: string[],
  services: ServiceDefinition[],
): ActionInsight['performanceInsight'] {
  const servicePosts = posts.filter((item) =>
    item.businessId === post.businessId && item.project === post.project && item.status !== 'skipped'
  );
  const measuredViews = servicePosts.filter((item) =>
    Number.isSafeInteger(item.performance?.views) && (item.performance?.views ?? -1) >= 0
  );
  if (measuredViews.length < 3) return undefined;

  const conversionReview = buildConversionReview(post, posts, today, occupiedDates, services);
  if (conversionReview.assessment.status === 'detected') {
    const { result } = conversionReview.assessment;
    return {
      title: 'Bookings aren’t following interest',
      evidence: `The latest three measured posts had ${result.views.toLocaleString()} views, ${result.saves.toLocaleString()} saves, and ${result.bookings.toLocaleString()} bookings (${(result.bookingRate * 100).toFixed(1)}% booking rate).`,
      recommendation: 'Review the booking path and build trust before making a stronger offer.',
    };
  }

  const standout = measuredViews
    .map((item) => ({ post: item, result: getOverperformer(item, servicePosts) }))
    .filter((item): item is { post: InsightPost; result: NonNullable<ReturnType<typeof getOverperformer>> } => Boolean(item.result))
    .sort((left, right) => right.result.multiple - left.result.multiple
      || right.post.date.localeCompare(left.post.date))[0];
  if (standout) {
    return {
      title: 'One post stood out for reach',
      evidence: `“${standout.post.title}” reached ${standout.result.views.toLocaleString()} views versus a ${Math.round(standout.result.averageViews).toLocaleString()}-view service average across ${standout.result.postCount} measured posts.`,
      recommendation: 'Keep its topic and approach in mind when planning the next move.',
    };
  }

  const flatInsight = buildFlatPostInsight('completed', post, posts, today, occupiedDates);
  return flatInsight ? {
    title: flatInsight.title,
    evidence: flatInsight.evidence,
    recommendation: flatInsight.recommendation,
  } : undefined;
}

function formatPostDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function formatPostOptionDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function CalendarSurface() {
  const { needsSetup, finishSetup } = useFirstRun();
  const [userPosts, setUserPosts] = useState<UserPost[]>(readUserPosts);
  const [businessOverrides, setBusinessOverrides] = useState(() =>
    loadBusinessOverrides(window.localStorage.getItem(businessOverridesStorageKey)));
  const [isBusinessManagerOpen, setIsBusinessManagerOpen] = useState(false);
  const [businessManagerAction, setBusinessManagerAction] = useState<'edit' | 'delete'>('edit');
  const [initialWorkspace] = useState(() => {
    const savedBusinesses = readUserBusinesses();
    const legacy = initializeLegacyWorkspace(
      window.localStorage.getItem(servicesStorageKey),
      userPosts,
      savedBusinesses,
      JSON.parse(window.localStorage.getItem(businessContentSettingsStorageKey) ?? '{}'),
      loadServiceSeasonSelections(window.localStorage.getItem(serviceSeasonsStorageKey)),
      readAvailablePlatforms(),
    );
    return {
      services: legacy.services,
      businesses: [
        ...savedBusinesses,
        ...legacyBusinessIdentities.filter(({ id }) =>
          !savedBusinesses.some((business) => business.id === id)
          && !businessOverrides[id]?.deleted
          && (businessOverrides[id]?.name || legacy.recoveredBusinesses.some((business) => business.id === id)))
          .map(({ id, name, accent }) =>
            createBusinessWorkspace(id, businessOverrides[id]?.name ?? name, accent)),
      ],
    };
  });
  const [userBusinesses, setUserBusinesses] = useState<Business[]>(initialWorkspace.businesses);
  const businesses = useMemo(() => userBusinesses.filter((business) =>
    !businessOverrides[business.id]?.deleted), [userBusinesses, businessOverrides]);
  const [businessContentSettingsById, setBusinessContentSettingsById] = useState(() =>
    readBusinessContentSettings(businesses));
  const [activeBusinessId, setActiveBusinessId] = useState(() => {
    const savedBusinessId = window.localStorage.getItem(activeBusinessStorageKey);
    return savedBusinessId && businesses.some((item) => item.id === savedBusinessId)
      ? savedBusinessId
      : businesses[0]?.id ?? emptyWorkspace.id;
  });
  const [todayKey, setTodayKey] = useState(() => formatDateInput(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => mondayStart(new Date()));
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [statusMessage, setStatusMessage] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    parseNotifications(window.localStorage.getItem(notificationsStorageKey)));
  const { soundEnabled, toggleSound } = useNotificationSound(notifications, activeBusinessId);
  const recordNotification = useCallback((
    notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>,
    refreshExisting = false,
  ) => {
    const entry: AppNotification = {
      ...notification,
      id: createPostId(),
      createdAt: Date.now(),
      isRead: false,
    };
    setNotifications((current) => {
      const existingIndex = notification.dedupeKey
        ? current.findIndex((item) => item.dedupeKey === notification.dedupeKey)
        : -1;
      if (existingIndex >= 0) {
        if (!refreshExisting) return current;
        return current.map((item, index) => index === existingIndex ? entry : item);
      }
      return [entry, ...current];
    });
  }, []);
  const [services, setServices] = useState<ServiceDefinition[]>(() =>
    markExpiredCampaignsDormant(initialWorkspace.services, todayKey));
  const [seasonMonthsByService, setSeasonMonthsByService] = useState(() =>
    loadServiceSeasonSelections(window.localStorage.getItem(serviceSeasonsStorageKey)));
  const [isServiceManagerOpen, setIsServiceManagerOpen] = useState(false);
  const [isContentManagerOpen, setIsContentManagerOpen] = useState(false);
  const [isBusinessDialogOpen, setIsBusinessDialogOpen] = useState(false);
  const [isPostFormOpen, setIsPostFormOpen] = useState(false);
  const [weeklyInsightsContext, setWeeklyInsightsContext] = useState<{
    businessId: string;
    startKey: string;
    endKey: string;
  } | null>(null);
  const [selectedWeeklyInsightsPostId, setSelectedWeeklyInsightsPostId] = useState('');
  const [postForm, setPostForm] = useState<PostForm>(() => createPostForm(currentDateInput()));
  const [formError, setFormError] = useState('');
  const [actionInsight, setActionInsight] = useState<ActionInsight | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const business = businesses.find((item) => item.id === activeBusinessId) ?? businesses[0] ?? emptyWorkspace;
  const activeContentSettings = businessContentSettingsById[business.id]
    ?? createBusinessContentSettings(business.platforms);
  const availablePlatforms = activeContentSettings.platformOptions;
  const contentTypes = activeContentSettings.contentTypes;
  const businessServices = useMemo(
    () => services.filter((service) => service.businessId === business.id),
    [services, business.id],
  );
  const activeServices = useMemo(
    () => businessServices.filter((service) => service.mode !== 'campaign' || service.status !== 'dormant'),
    [businessServices],
  );
  const activeBusiness = useMemo(() => ({
    ...business,
    platforms: activeContentSettings.selectedPlatforms.filter((platform) => availablePlatforms.includes(platform)),
    projects: activeServices.map((service) => service.name),
    palette: businessServices.map((service) => ({
      label: service.name,
      tone: service.tone ?? business.palette.find((item) => item.label === service.name)?.tone ?? 'muted' as EventTone,
    })),
  }), [business, activeServices, businessServices, activeContentSettings, availablePlatforms]);
  const calendarDisplayMonth = calendarView === 'week'
    ? shiftCalendarDays(visibleWeekStart, 3)
    : visibleMonth;
  const days = useMemo(() => makeCalendarDays(visibleMonth), [visibleMonth]);
  const activeBusinessPosts = useMemo(
    () => userPosts.filter((post) => post.businessId === activeBusiness.id),
    [userPosts, activeBusiness.id],
  );
  const activeNotifications = useMemo(
    () => notifications.filter((item) => item.businessId === activeBusiness.id)
      .sort((left, right) => right.createdAt - left.createdAt),
    [notifications, activeBusiness.id],
  );
  const unreadNotificationCount = activeNotifications.filter((item) => !item.isRead).length;
  const campaignWakeupBanners = activeNotifications.filter((item) => {
    const action = item.action;
    return item.kind === 'campaign-wakeup' && !item.bannerDismissed && action?.kind === 'campaign-wakeup'
      && todayKey >= action.startDate && todayKey <= action.endDate
      && businessServices.some((service) => service.id === action.campaignId
        && service.mode === 'campaign' && service.status === 'dormant');
  });
  const weeklyInsightsPosts = useMemo(() => {
    if (!weeklyInsightsContext || weeklyInsightsContext.businessId !== activeBusiness.id) return [];
    return activeBusinessPosts
      .filter((post) => post.status !== 'skipped' && post.date >= weeklyInsightsContext.startKey
        && post.date <= weeklyInsightsContext.endKey)
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [activeBusinessPosts, activeBusiness.id, weeklyInsightsContext]);
  const selectedWeeklyInsightsPost = weeklyInsightsPosts.find(
    (post) => post.id === selectedWeeklyInsightsPostId,
  );
  const monthPosts = activeBusinessPosts.filter((post) => post.date.startsWith(monthKey(visibleMonth)));
  const monthlyAirtime = getMonthlyAirtime(
    activeBusiness.id,
    activeBusiness.projects,
    activeBusinessPosts,
    calendarDisplayMonth.getFullYear(),
    calendarDisplayMonth.getMonth() + 1,
  );
  const selectedUserPost = userPosts.find(
    (post) => post.id === selectedPostId && post.businessId === activeBusiness.id,
  );
  const selectedService = businessServices.find((service) => service.name === selectedUserPost?.project);
  const conversionMarkers = useMemo(
    () => getConversionGapMarkers(activeBusinessPosts),
    [activeBusinessPosts],
  );
  const rawConversionReview = selectedUserPost ? buildConversionReview(
    selectedUserPost,
    activeBusinessPosts,
    formatDateInput(new Date()),
    [],
    businessServices,
  ) : null;
  const conversionReview = rawConversionReview?.proposal
    && !contentTypes.includes(rawConversionReview.proposal.contentType)
    ? { ...rawConversionReview, proposal: undefined }
    : rawConversionReview;
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
    ...(contentTypes.includes(post.contentType) ? { contentTypeName: post.contentType } : {}),
    ...(conversionMarkers.has(post.id) ? { conversionGap: post.project } : {}),
    ...(post.isCompleted ? { isCompleted: true } : {}),
    ...(post.status === 'skipped' ? { isSkipped: true } : {}),
    ...(post.schedulingStatus === 'approved-suggestion'
      ? { bestTime: getBestTimeRecommendation(post.businessId, post.project, post.platforms, activeBusinessPosts) }
      : {}),
  });
  const calendarEvents = monthPosts.map(postAsEvent);
  const weekStartKey = formatDateInput(visibleWeekStart);
  const weekEndKey = formatDateInput(shiftCalendarDays(visibleWeekStart, 6));
  const isInWeek = (date: string) => date >= weekStartKey && date <= weekEndKey;
  const weekCalendarItems: WeekCalendarItem[] = [
    ...activeBusinessPosts.filter((post) => isInWeek(post.date)).map((post) => {
      const contentType = contentTypes.includes(post.contentType) ? post.contentType : undefined;
      const isSuggestion = post.schedulingStatus === 'approved-suggestion';
      return {
        id: post.id, date: post.date, title: post.title, project: post.project, contentType,
        platformLabel: post.platforms.join(' · ') || 'Platform not set',
        timeLabel: post.postedTime || (isSuggestion
          ? getBestTimeRecommendation(activeBusiness.id, post.project, post.platforms, activeBusinessPosts).compactLabel
          : 'Time not set'),
        colorClass: contentType ? 'event-content-type' : `event-${getPostTone(post.project, activeBusiness)}`,
        colorStyle: contentType ? getContentTypeStyle(contentType) : undefined,
        isSuggestion,
        isCompleted: post.isCompleted,
        isSkipped: post.status === 'skipped',
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const midCampaignCheckIns: MidCampaignCheckIn[] = activeBusinessPosts.flatMap((post) => {
    if (post.status === 'skipped' || post.distribution !== 'paid'
      || typeof post.budget !== 'number'
      || !Number.isFinite(post.budget)
      || post.budget <= 0
      || !Number.isSafeInteger(post.runLength)
      || !post.runLength
      || post.runLength <= 0) return [];
    const startDate = new Date(`${post.date}T12:00:00`);
    if (!Number.isFinite(startDate.getTime()) || formatDateInput(startDate) !== post.date) return [];
    const midpointDate = shiftCalendarDays(startDate, Math.floor(post.runLength / 2));
    const runEndDate = shiftCalendarDays(startDate, post.runLength);
    const midpointKey = formatDateInput(midpointDate);
    const runEndKey = formatDateInput(runEndDate);
    const isRunning = todayKey >= post.date && todayKey < runEndKey;
    if (!isRunning || !isInWeek(midpointKey)) return [];
    return [{
      postId: post.id,
      campaignName: post.project,
      postTitle: post.title,
      midpointDate: midpointKey,
    }];
  });
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
    setServices((current) => markExpiredCampaignsDormant(current, todayKey));
  }, [todayKey]);
  useEffect(() => {
    services.forEach((service) => {
      if (service.mode !== 'campaign' || service.status !== 'dormant') return;
      const cycle = nextCampaignWakeCycle(service, todayKey);
      if (!cycle || !isCampaignWakeCycleOpen(service, cycle, todayKey)) return;
      recordNotification({
        businessId: service.businessId,
        dedupeKey: `campaign-wakeup:${service.businessId}:${service.id}:${cycle.cycleKey}`,
        icon: 'calendar',
        title: `Running ${service.name} again?`,
        subtitle: 'I kept the last cycle’s posts and results. Use them to shape this Campaign’s starting plan.',
        kind: 'campaign-wakeup',
        bannerDismissed: false,
        action: {
          kind: 'campaign-wakeup',
          label: 'Run this Campaign',
          campaignId: service.id,
          cycleKey: cycle.cycleKey,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
        },
      });
    });
  }, [services, todayKey, recordNotification]);
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
    try {
      window.localStorage.setItem(notificationsStorageKey, JSON.stringify(notifications));
    } catch {
      setStatusMessage('Notifications could not be saved on this device.');
    }
  }, [notifications]);
  useEffect(() => {
    setActionInsight((current) => {
      if (!current?.sourcePostId) return current;
      const source = activeBusinessPosts.find((post) => post.id === current.sourcePostId);
      if (!source || source.businessId !== activeBusiness.id) return null;
      if (current.performanceOnly) return current;
      const sequenceOnly = current.action === 'completed' && Boolean(current.sequenceAnchorDate);
      const refreshedSequence = buildBusinessActionInsight(
        current.action,
        source,
        activeBusinessPosts,
        todayKey,
        [],
        businessServices,
        contentTypes,
        sequenceOnly,
        current.sequenceAnchorDate,
      );
      const refreshed = current.performanceInsight
        ? { ...refreshedSequence, performanceInsight: current.performanceInsight }
        : refreshedSequence;
      return JSON.stringify(current) === JSON.stringify(refreshed) ? current : refreshed;
    });
  }, [activeBusiness.id, activeBusinessPosts, businessServices, todayKey, contentTypes]);

  useEffect(() => {
    if (!actionInsight?.sourcePostId) return;
    const source = activeBusinessPosts.find((post) => post.id === actionInsight.sourcePostId);
    if (!source) return;
    const proposal = actionInsight.proposals[0];
    const description = proposal
      ? `${proposal.contentType} for ${source.project}, ${formatPostOptionDate(proposal.date)}`
      : `${source.project} · ${actionInsight.performanceInsight?.title ?? actionInsight.title}`;
    const dedupeKey = insightNotificationKey(activeBusiness.id, actionInsight);
    const performanceAlert = actionInsight.action !== 'skipped' && (
      actionInsight.performanceInsight || actionInsight.performanceOnly || actionInsight.action === 'results'
    ) ? getCompletionPerformanceInsight(
        source,
        activeBusinessPosts.filter((post) => post.date <= todayKey),
        todayKey,
        [],
        businessServices,
      ) : undefined;
    recordNotification({
      businessId: activeBusiness.id,
      dedupeKey,
      icon: 'sparkle',
      title: 'New insight surfaced',
      subtitle: description,
      kind: 'insight',
      ...(performanceAlert ? {
        attentionEventKey: performanceAttentionKey(activeBusiness.id, source.project, performanceAlert),
      } : {}),
      action: {
        kind: 'reopen-insight',
        label: 'Reopen insight',
        sourcePostId: source.id,
        insight: actionInsight,
      },
    });
  }, [actionInsight, activeBusiness.id, activeBusinessPosts, recordNotification, todayKey, businessServices]);

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
    if (activeBusiness.id === emptyWorkspace.id) return 'Add a business before creating its services.';
    const error = validateService(draft);
    if (error) return error;
    if (draft.businessId !== activeBusiness.id) return 'Choose a service in this business.';
    const existing = services.find((service) => service.id === draft.id);
    const revivingDormantCampaign = existing?.mode === 'campaign'
      && existing.status === 'dormant'
      && draft.mode === 'campaign'
      && draft.status === 'active';
    if (existing && (existing.businessId !== draft.businessId
      || (existing.name !== draft.name.trim() && !revivingDormantCampaign))) {
      return 'The existing service name cannot be changed here.';
    }
    if (services.some((service) => service.id !== draft.id && service.businessId === draft.businessId
      && service.name.toLowerCase() === draft.name.trim().toLowerCase())) return 'That name is already used in this business.';
    const requestedPlatforms = draft.platforms ?? existing?.platforms ?? activeBusiness.platforms;
    const platforms = [...new Set(requestedPlatforms.filter((platform) => availablePlatforms.includes(platform)))];
    if (platforms.length === 0) return 'Choose at least one available platform for this service or campaign.';
    const existingTone = activeBusiness.palette.find((item) => item.label === draft.name.trim())?.tone;
    const tone = existing?.tone ?? existingTone ?? nextServiceTone(activeBusiness.palette.map((item) => item.tone));
    const saved = normalizeService({
      ...existing,
      ...draft,
      name: draft.name.trim(),
      platforms,
      tone,
      ...(revivingDormantCampaign && existing?.mode === 'campaign' ? {
        wakeUpHandledCycles: existing.wakeUpHandledCycles,
        wakeSourcePostId: bestCampaignLearningPost(existing, userPosts)?.id,
      } : {}),
    });
    if (revivingDormantCampaign && saved.mode === 'campaign') {
      const cycle = { cycleKey: `${saved.id}:${saved.startDate}`, startDate: saved.startDate, endDate: saved.endDate };
      return reactivateCampaign(saved, cycle);
    }
    const updated = existing ? services.map((service) => service.id === saved.id ? saved : service) : [...services, saved];
    try {
      window.localStorage.setItem(servicesStorageKey, JSON.stringify(updated));
    } catch {
      return 'This device could not save the change. Free some storage and try again.';
    }
    setServices(updated);
    return saved;
  };

  const handleCloseCampaign = (campaign: Extract<ServiceDefinition, { mode: 'campaign' }>): string | undefined => {
    if (campaign.businessId !== activeBusiness.id || campaign.status === 'dormant') {
      return 'This Campaign is already dormant.';
    }
    const updated = services.map((service) => service.id === campaign.id && service.businessId === activeBusiness.id
      ? { ...service, status: 'dormant' as const, dormantSince: todayKey }
      : service);
    try {
      window.localStorage.setItem(servicesStorageKey, JSON.stringify(updated));
    } catch {
      return 'This device could not save the Campaign status. Free some storage and try again.';
    }
    setServices(updated);
    return `${campaign.name} is dormant. Its posts and results are saved for next season.`;
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
    try {
      window.localStorage.setItem(
        businessContentSettingsStorageKey,
        JSON.stringify(businessContentSettingsById),
      );
    } catch {
      setStatusMessage('Content settings could not be saved on this device.');
    }
  }, [businessContentSettingsById]);

  const shiftMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    setStatusMessage('');
  };

  const showActionMessage = (message: string) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(''), 3000);
  };

  const keepPerformanceInsight = (insight: ActionInsight) => {
    if (!insight.performanceInsight) {
      setActionInsight(null);
      return;
    }
    setActionInsight({
      action: insight.action,
      sourcePostId: insight.sourcePostId,
      performanceOnly: true,
      title: insight.performanceInsight.title,
      evidence: insight.performanceInsight.evidence,
      recommendation: insight.performanceInsight.recommendation,
      beats: [],
      proposals: [],
    });
  };

  const handleDismissActionInsight = () => {
    if (!actionInsight) return;
    const sourcePostId = actionInsight.sourcePostId ?? actionInsight.proposals[0]?.triggerPostId;
    if (sourcePostId) {
      const source = activeBusinessPosts.find((post) => post.id === sourcePostId);
      recordNotification({
        businessId: activeBusiness.id,
        dedupeKey: insightNotificationKey(activeBusiness.id, actionInsight),
        icon: 'sparkle',
        title: 'Insight saved for later',
        subtitle: source
          ? `${source.project} · ${actionInsight.performanceInsight?.title ?? actionInsight.title}`
          : actionInsight.title,
        kind: 'dismissed-banner',
        action: {
          kind: 'reopen-insight',
          label: 'Reopen insight',
          sourcePostId,
          insight: actionInsight,
        },
      }, true);
    }
    if (actionInsight.proposals.length > 0) keepPerformanceInsight(actionInsight);
    else setActionInsight(null);
  };

  const selectCalendarView = (view: 'month' | 'week') => {
    if (view === calendarView) return;
    if (view === 'week' && monthKey(shiftCalendarDays(visibleWeekStart, 3)) !== monthKey(visibleMonth)) {
      setVisibleWeekStart(mondayStart(visibleMonth));
    } else if (view === 'month') {
      const focus = shiftCalendarDays(visibleWeekStart, 3);
      setVisibleMonth(new Date(focus.getFullYear(), focus.getMonth(), 1));
    }
    setCalendarView(view);
    setStatusMessage('');
  };

  const revealDateInCalendar = (date: string) => {
    const day = new Date(`${date}T12:00:00`);
    setVisibleMonth(day);
    if (calendarView === 'week') setVisibleWeekStart(mondayStart(day));
  };

  const reactivateCampaign = (
    campaignDraft: Extract<ServiceDefinition, { mode: 'campaign' }>,
    cycle: { cycleKey: string; startDate: string; endDate: string },
    notificationId?: string,
  ): string | Extract<ServiceDefinition, { mode: 'campaign' }> => {
    const dormant = services.find((service) => service.id === campaignDraft.id
      && service.businessId === campaignDraft.businessId);
    if (!dormant || dormant.mode !== 'campaign' || dormant.status !== 'dormant') {
      return 'This Campaign is no longer dormant.';
    }
    if (cycle.endDate < todayKey) {
      return 'That Campaign window has passed. Use Manage services to choose dates for its next cycle.';
    }
    if (services.some((service) => service.id !== dormant.id
      && service.businessId === dormant.businessId
      && service.name.toLowerCase() === campaignDraft.name.trim().toLowerCase())) {
      return 'Another service in this business already uses that name.';
    }

    const learningPost = bestCampaignLearningPost(dormant, userPosts);
    const platforms = (campaignDraft.platforms ?? activeBusiness.platforms)
      .filter((platform) => availablePlatforms.includes(platform));
    if (platforms.length === 0) return 'Choose an available platform in Manage services before restarting this Campaign.';
    const previousCycle = {
      name: dormant.name,
      startDate: dormant.startDate,
      endDate: dormant.endDate,
      closedAt: dormant.dormantSince,
      postIds: userPosts.filter((post) => post.businessId === dormant.businessId && post.project === dormant.name
        && post.date >= dormant.startDate && post.date <= dormant.endDate).map((post) => post.id),
      platforms: dormant.platforms,
      tone: dormant.tone,
    };
    const history = dormant.campaignHistory ?? [];
    const campaignHistory = history.some((entry) => entry.startDate === previousCycle.startDate
      && entry.endDate === previousCycle.endDate && entry.name === previousCycle.name)
      ? history : [...history, previousCycle];
    const revivalInput = {
      ...campaignDraft,
      name: campaignDraft.name.trim(),
      platforms,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: 'active' as const,
      dormantSince: undefined,
      wakeUpHandledCycles: handledWakeCycle(dormant, cycle.cycleKey),
      campaignHistory,
      ...(learningPost ? { wakeSourcePostId: learningPost.id } : {}),
    };
    const revivalError = validateService(revivalInput);
    if (revivalError) return revivalError;
    const revived = normalizeService(revivalInput) as Extract<ServiceDefinition, { mode: 'campaign' }>;
    const nextServices = services.map((service) => service.id === dormant.id ? revived : service);
    const nextPosts = userPosts.map((post) =>
      post.businessId === dormant.businessId && post.project === dormant.name
        ? { ...post, project: revived.name }
        : post);
    try {
      window.localStorage.setItem(servicesStorageKey, JSON.stringify(nextServices));
      window.localStorage.setItem(userPostsStorageKey, JSON.stringify(nextPosts));
    } catch {
      try {
        window.localStorage.setItem(servicesStorageKey, JSON.stringify(services));
        window.localStorage.setItem(userPostsStorageKey, JSON.stringify(userPosts));
      } catch {
        // In-memory records are unchanged; the save error remains visible below.
      }
      return 'This device could not save the Campaign. Free some storage and try again.';
    }

    setServices(nextServices);
    setUserPosts(nextPosts);
    const relatedWakeup = notifications.find((notification) =>
      notification.kind === 'campaign-wakeup'
      && notification.businessId === dormant.businessId
      && notification.action?.kind === 'campaign-wakeup'
      && notification.action.campaignId === dormant.id);
    setNotifications((current) => current.map((notification) =>
      notification.kind === 'campaign-wakeup'
      && notification.businessId === dormant.businessId
      && notification.action?.kind === 'campaign-wakeup'
      && notification.action.campaignId === dormant.id
        ? {
          ...notification,
          title: 'Campaign restarted',
          subtitle: `${revived.name} is active again with last cycle’s posts and results.`,
          isRead: true,
          bannerDismissed: true,
          action: undefined,
        }
        : notification));
    if (!relatedWakeup && !notificationId) {
      recordNotification({
        businessId: revived.businessId,
        dedupeKey: `campaign-wakeup:${revived.businessId}:${revived.id}:${cycle.cycleKey}:restarted`,
        icon: 'calendar',
        title: 'Campaign restarted',
        subtitle: `${revived.name} is active again with last cycle’s posts and results.`,
        kind: 'campaign-wakeup',
        bannerDismissed: true,
      });
    }
    if (notificationId) {
      setNotifications((current) => current.map((notification) => notification.id === notificationId
        ? {
          ...notification,
          title: 'Campaign restarted',
          subtitle: `${revived.name} is active again with last cycle’s posts and results.`,
          isRead: true,
          bannerDismissed: true,
          action: undefined,
        }
        : notification));
    }

    if (activeBusiness.id === revived.businessId && learningPost) {
      const source = nextPosts.find((post) => post.id === learningPost.id);
      if (source) {
        const anchor = cycle.startDate > todayKey ? cycle.startDate : todayKey;
        const insight = buildBusinessActionInsight(
          'completed',
          source,
          nextPosts.filter((post) => post.businessId === revived.businessId),
          todayKey,
          [],
          nextServices.filter((service) => service.businessId === revived.businessId),
          contentTypes,
          true,
          anchor,
        );
        setActionInsight(insight);
        revealDateInCalendar(anchor);
      }
    }
    showActionMessage(`${revived.name} is active again. Its past posts and results are still saved.`);
    return revived;
  };

  const markCampaignWakeHandled = (businessId: string, campaignId: string, cycleKey: string) => {
    setServices((current) => current.map((service) =>
      service.id === campaignId && service.businessId === businessId && service.mode === 'campaign'
        ? { ...service, wakeUpHandledCycles: handledWakeCycle(service, cycleKey) }
        : service));
  };

  const dismissCampaignNameMatch = (
    campaign: Extract<ServiceDefinition, { mode: 'campaign' }>,
    cycle: { cycleKey: string; startDate: string; endDate: string },
  ) => {
    if (campaign.businessId !== activeBusiness.id) return;
    markCampaignWakeHandled(campaign.businessId, campaign.id, cycle.cycleKey);
    const dedupeKey = `campaign-wakeup:${campaign.businessId}:${campaign.id}:${cycle.cycleKey}`;
    recordNotification({
      businessId: campaign.businessId,
      dedupeKey,
      icon: 'calendar',
      kind: 'campaign-wakeup',
      title: `Running ${campaign.name} again?`,
      subtitle: 'Saved for when you’re ready. The previous cycle’s posts and results are still here.',
      bannerDismissed: true,
      action: { kind: 'campaign-wakeup', label: 'Run this Campaign', campaignId: campaign.id, ...cycle },
    });
    setNotifications((current) => current.map((notification) => notification.dedupeKey === dedupeKey
      ? { ...notification, bannerDismissed: true, isRead: true } : notification));
  };

  const dismissCampaignWakeupBanner = (notification: AppNotification) => {
    const action = notification.action;
    if (action?.kind !== 'campaign-wakeup' || notification.businessId !== activeBusiness.id) return;
    markCampaignWakeHandled(notification.businessId, action.campaignId, action.cycleKey);
    setNotifications((current) => current.map((item) => item.id === notification.id
      ? { ...item, isRead: true, bannerDismissed: true }
      : item));
  };

  const handleOpenNotification = (notification: AppNotification) => {
    const action = notification.action;
    if (notification.businessId !== activeBusiness.id || !action) return;
    if (action.kind === 'campaign-wakeup') {
      const campaign = services.find((service) => service.id === action.campaignId
        && service.businessId === notification.businessId);
      if (!campaign || campaign.mode !== 'campaign') {
        showActionMessage('That Campaign is no longer available in this business.');
        return;
      }
      const result = reactivateCampaign({
        ...campaign,
        name: campaignNameForCycle(campaign.name, action),
      }, action, notification.id);
      if (typeof result === 'string') showActionMessage(result);
      return;
    }
    if (action.kind === 'calendar-post') {
      const post = activeBusinessPosts.find((item) => item.id === action.postId);
      if (!post) {
        showActionMessage('That post is no longer on this business calendar.');
        return;
      }
      setCalendarView('month');
      revealDateInCalendar(post.date);
      setSelectedPostId(post.id);
      setActionInsight(null);
      return;
    }

    const source = activeBusinessPosts.find((post) => post.id === action.sourcePostId);
    if (!source) {
      showActionMessage('That insight is no longer available because its post was removed.');
      return;
    }
    setCalendarView('month');
    revealDateInCalendar(source.date);
    setSelectedPostId(null);
    setActionInsight(action.insight);
  };

  const markActiveNotificationsRead = () => {
    setNotifications((current) => current.map((notification) =>
      notification.businessId === activeBusiness.id && !notification.isRead
        ? { ...notification, isRead: true }
        : notification));
  };

  const dismissActiveNotification = (notificationId: string) => {
    const notification = activeNotifications.find((item) => item.id === notificationId);
    if (notification?.action?.kind === 'campaign-wakeup') {
      markCampaignWakeHandled(notification.businessId, notification.action.campaignId, notification.action.cycleKey);
    }
    setNotifications((current) => current.filter((notification) =>
      notification.id !== notificationId || notification.businessId !== activeBusiness.id));
  };

  const clearActiveNotifications = () => {
    const wakeups = activeNotifications.flatMap((notification) => notification.action?.kind === 'campaign-wakeup'
      ? [notification.action] : []);
    if (wakeups.length) {
      setServices((current) => current.map((service) => {
        if (service.businessId !== activeBusiness.id || service.mode !== 'campaign') return service;
        const cycles = wakeups.filter((action) => action.campaignId === service.id).map((action) => action.cycleKey);
        return cycles.length
          ? { ...service, wakeUpHandledCycles: [...new Set([...(service.wakeUpHandledCycles ?? []), ...cycles])] }
          : service;
      }));
    }
    setNotifications((current) => current.filter((notification) =>
      notification.businessId !== activeBusiness.id));
  };

  const openPostForm = () => {
    if (activeBusiness.id === emptyWorkspace.id) {
      setIsBusinessDialogOpen(true);
      return;
    }
    setPostForm(createPostForm(currentDateInput(), activeBusiness.platforms));
    setFormError('');
    setStatusMessage('');
    setIsPostFormOpen(true);
  };

  const closePostForm = () => {
    setIsPostFormOpen(false);
    setFormError('');
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

  const updateBusinessContentCatalog = (
    kind: ContentCatalogKind,
    operation: ContentCatalogOperation,
    name: string,
    replacement?: string,
  ): string | undefined => {
    const currentSettings = businessContentSettingsById[activeBusiness.id];
    if (!currentSettings) return 'Content settings are not available for this business.';
    const nextSettings: BusinessContentSettings = {
      ...currentSettings,
      contentTypes: [...currentSettings.contentTypes],
      platformOptions: [...currentSettings.platformOptions],
      selectedPlatforms: [...currentSettings.selectedPlatforms],
      contentTypeAliases: { ...currentSettings.contentTypeAliases },
    };
    let nextPosts = userPosts;
    let nextServices = services;
    let nextUserBusinesses = userBusinesses;
    let nextPostForm = postForm;
    let shouldCloseSelectedPost = false;

    if (kind === 'content type') {
      if (operation === 'add' && replacement) {
        nextSettings.contentTypes = [...nextSettings.contentTypes, name];
        if (defaultContentTypes.includes(name)) nextSettings.contentTypeAliases[name] = name;
      } else if (operation === 'rename' && replacement) {
        nextSettings.contentTypes = nextSettings.contentTypes.map((item) => item === name ? replacement : item);
        nextSettings.contentTypeAliases = renameContentTypeAliases(nextSettings.contentTypeAliases, name, replacement);
        nextPosts = userPosts.map((post) => post.businessId === activeBusiness.id && post.contentType === name
          ? { ...post, contentType: replacement }
          : post);
      } else if (operation === 'delete') {
        nextSettings.contentTypes = nextSettings.contentTypes.filter((item) => item !== name);
        nextSettings.contentTypeAliases = deleteContentTypeAliases(nextSettings.contentTypeAliases, name);
        nextPosts = userPosts.map((post) => post.businessId === activeBusiness.id && post.contentType === name
          ? { ...post, contentType: '' }
          : post);
        if (postForm.contentType === name) nextPostForm = { ...postForm, contentType: '' };
        shouldCloseSelectedPost = selectedUserPost?.contentType === name;
      } else {
        return 'This content type could not be updated.';
      }
      if (operation === 'rename') {
        if (postForm.contentType === name) nextPostForm = { ...postForm, contentType: replacement ?? '' };
      }
    } else {
      if (operation === 'add' && replacement) {
        nextSettings.platformOptions = [...nextSettings.platformOptions, name];
      } else if (operation === 'rename' && replacement) {
        nextSettings.platformOptions = nextSettings.platformOptions.map((item) => item === name ? replacement : item);
        nextSettings.selectedPlatforms = nextSettings.selectedPlatforms.map((item) => item === name ? replacement : item);
      } else if (operation === 'delete') {
        nextSettings.platformOptions = nextSettings.platformOptions.filter((item) => item !== name);
        nextSettings.selectedPlatforms = nextSettings.selectedPlatforms.filter((item) => item !== name);
      } else {
        return 'This platform could not be updated.';
      }

      if (operation === 'rename' || operation === 'delete') {
        const updatePlatforms = (platforms: string[]) => operation === 'delete'
          ? platforms.filter((platform) => platform !== name)
          : platforms.map((platform) => platform === name ? replacement! : platform);
        nextPosts = userPosts.map((post) => post.businessId === activeBusiness.id
          ? { ...post, platforms: updatePlatforms(post.platforms) }
          : post);
        nextServices = services.map((service) => {
          if (service.businessId !== activeBusiness.id || !service.platforms) return service;
          const platforms = updatePlatforms(service.platforms);
          if (platforms.length > 0) return { ...service, platforms };
          const { platforms: _removedPlatforms, ...withoutPlatforms } = service;
          return withoutPlatforms;
        });
        nextPostForm = {
          ...postForm,
          platforms: updatePlatforms(postForm.platforms),
        };
      }
      nextUserBusinesses = userBusinesses.map((item) => item.id === activeBusiness.id
        ? { ...item, platforms: [...nextSettings.selectedPlatforms] }
        : item);
    }

    const nextSettingsById = { ...businessContentSettingsById, [activeBusiness.id]: nextSettings };
    const entries: Array<[string, string]> = [
      [businessContentSettingsStorageKey, JSON.stringify(nextSettingsById)],
    ];
    if (nextServices !== services) entries.push([servicesStorageKey, JSON.stringify(nextServices)]);
    if (nextPosts !== userPosts) entries.push([userPostsStorageKey, JSON.stringify(nextPosts)]);
    if (nextUserBusinesses !== userBusinesses) {
      entries.push([userBusinessesStorageKey, JSON.stringify(nextUserBusinesses.map(({ id, name, accent, platforms }) => ({
        id, name, accent, platforms,
      })))]);
    }
    try {
      writeLocalStorageBatch(entries);
    } catch {
      return 'This change could not be saved on this device. Free some storage and try again.';
    }

    setBusinessContentSettingsById(nextSettingsById);
    if (nextServices !== services) setServices(nextServices);
    if (nextPosts !== userPosts) setUserPosts(nextPosts);
    if (nextUserBusinesses !== userBusinesses) setUserBusinesses(nextUserBusinesses);
    if (nextPostForm !== postForm) setPostForm(nextPostForm);
    if (shouldCloseSelectedPost) setSelectedPostId(null);
    setActionInsight(null);
    return undefined;
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
    setActionInsight(buildBusinessActionInsight(
      'logged',
      savedPost,
      postsAfterSave.filter((post) => post.businessId === activeBusiness.id),
      todayKey,
      [],
      businessServices,
      contentTypes,
    ));
    revealDateInCalendar(savedPost.date);
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
    const sequenceOnly = actionInsight.action === 'completed' && Boolean(actionInsight.sequenceAnchorDate);
    const refreshedSequence = buildBusinessActionInsight(
      actionInsight.action,
      source,
      activeBusinessPosts,
      formatDateInput(new Date()),
      [],
      businessServices,
      contentTypes,
      sequenceOnly,
      actionInsight.sequenceAnchorDate,
    );
    const refreshed = actionInsight.performanceInsight
      ? { ...refreshedSequence, performanceInsight: actionInsight.performanceInsight }
      : refreshedSequence;
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
        distribution: proposal.distribution ?? original?.distribution ?? 'organic',
        schedulingStatus: 'approved-suggestion',
        sourcePostId: proposal.sourcePostId,
        suggestionKind: proposal.kind,
      }];
    });

    if (suggestions.length > 0) {
      const replacementIds = new Set(refreshed.proposals.flatMap((proposal) => proposal.replaces ? [proposal.replaces.postId] : []));
      const appliedSuggestions = suggestions.filter((suggestion) => {
        const proposal = refreshed.proposals.find((candidate) =>
          candidate.sourcePostId === suggestion.sourcePostId
          && candidate.contentType === suggestion.contentType
          && candidate.date === suggestion.date);
        if (proposal?.replaces) return true;
        return !activeBusinessPosts.some((existing) =>
          existing.schedulingStatus === 'approved-suggestion'
          && existing.sourcePostId === suggestion.sourcePostId
          && existing.contentType === suggestion.contentType
          && existing.date === suggestion.date);
      });
      setUserPosts((current) => {
        const revised = current.map((existing) => replacementIds.has(existing.id)
          ? suggestions.find((suggestion) => suggestion.id === existing.id) ?? existing : existing);
        return [...revised, ...suggestions.filter((suggestion) => !replacementIds.has(suggestion.id)
          && !revised.some((existing) => existing.schedulingStatus === 'approved-suggestion'
            && existing.sourcePostId === suggestion.sourcePostId && existing.contentType === suggestion.contentType
            && existing.date === suggestion.date))];
      });
      appliedSuggestions.forEach((suggestion) => {
        const moved = refreshed.proposals.some((proposal) =>
          proposal.sourcePostId === suggestion.sourcePostId
          && proposal.contentType === suggestion.contentType
          && proposal.date === suggestion.date
          && Boolean(proposal.replaces));
        recordNotification({
          businessId: activeBusiness.id,
          dedupeKey: `plan-change:${activeBusiness.id}:${suggestion.id}:${suggestion.date}:${suggestion.contentType}`,
          icon: 'calendar',
          title: moved ? 'Plan updated' : 'New suggestion added',
          subtitle: `${suggestion.contentType} for ${suggestion.project}, ${formatPostOptionDate(suggestion.date)} · Airtime balance updated`,
          kind: 'plan-change',
          action: {
            kind: 'calendar-post',
            label: 'View on calendar',
            postId: suggestion.id,
            date: suggestion.date,
          },
        });
      });
      setSelectedPostId(null);
      revealDateInCalendar(suggestions[0].date);
      showActionMessage(`${suggestions.length} suggested ${suggestions.length === 1 ? 'change was' : 'changes were'} applied to the calendar.`);
    }
    keepPerformanceInsight(actionInsight);
  };

  const handleDeletePost = () => {
    if (!selectedUserPost) return;

    setUserPosts((current) => current.filter((post) => post.id !== selectedUserPost.id));
    setActionInsight(null);
    setSelectedPostId(null);
    showActionMessage(`Deleted “${selectedUserPost.title}” from the calendar.`);
  };

  const handleSaveResultsForPost = (
    postToUpdate: UserPost,
    performance: PostPerformance,
    postedTime?: string,
  ) => {
    if (postToUpdate.businessId !== activeBusiness.id) return;

    const postsAfterSave = userPosts.map((post) =>
      post.id === postToUpdate.id && post.businessId === postToUpdate.businessId
        ? { ...post, performance, postedTime: postedTime || undefined }
        : post
    );
    setUserPosts(postsAfterSave);
    const savedPost = postsAfterSave.find((post) => post.id === postToUpdate.id
      && post.businessId === postToUpdate.businessId);
    if (!savedPost) return;
    const businessPostsAfterSave = postsAfterSave.filter((post) => post.businessId === postToUpdate.businessId);
    const flatState = getFlatPostState(savedPost, businessPostsAfterSave, todayKey);
    const service = businessServices.find((item) => item.name === savedPost.project);
    const winner = getOverperformer(savedPost, businessPostsAfterSave.filter((post) => (post as InsightPost).status !== 'skipped' && post.date <= todayKey));
    setActionInsight((flatState.action !== 'none' && flatState.latestPostId === savedPost.id) || winner || service?.mode === 'campaign'
      ? buildBusinessActionInsight('results', savedPost, businessPostsAfterSave,
        todayKey, [], businessServices, contentTypes)
      : null);
  };

  const handleSaveResults = (performance: PostPerformance, postedTime?: string) => {
    if (!selectedUserPost) return;
    handleSaveResultsForPost(selectedUserPost, performance, postedTime);
  };

  const handlePostCompleted = (post: UserPost) => {
    if (post.businessId !== activeBusiness.id) return;
    const completionPosts = activeBusinessPosts.map((item) => item.id === post.id ? post : item);
    const sequenceAnchorDate = post.date > todayKey ? post.date : todayKey;
    const sequence = buildBusinessActionInsight(
      'completed',
      post,
      completionPosts,
      todayKey,
      [],
      businessServices,
      contentTypes,
      true,
      sequenceAnchorDate,
    );
    const performanceInsight = getCompletionPerformanceInsight(
      post,
      completionPosts,
      todayKey,
      [],
      businessServices,
    );
    setActionInsight({
      ...sequence,
      ...(performanceInsight ? { performanceInsight } : {}),
    });
  };

  const handleTogglePostCompletion = (postId: string, isCompleted: boolean) => {
    const post = activeBusinessPosts.find((item) => item.id === postId);
    if (!post || post.businessId !== activeBusiness.id) return;
    setUserPosts((current) => current.map((item) =>
      item.id === postId && item.businessId === activeBusiness.id
        ? { ...item, isCompleted, status: undefined }
        : item));
    if (isCompleted && !post.isCompleted) {
      handlePostCompleted({ ...post, isCompleted: true, status: undefined });
    }
  };

  const handleSkipPost = (postId: string) => {
    const post = activeBusinessPosts.find((item) => item.id === postId);
    if (!post) return;
    const undo = post.status === 'skipped';
    const updated: UserPost = { ...post, isCompleted: false, status: undo ? undefined : 'skipped' };
    setUserPosts((current) => current.map((item) =>
      item.id === postId && item.businessId === activeBusiness.id ? updated : item));
    closeSelectedPost();
    if (undo) {
      setActionInsight(null);
      showActionMessage(`“${post.title}” is planned again.`);
      return;
    }
    const updatedPosts = activeBusinessPosts.map((item) => item.id === postId ? updated : item);
    setActionInsight(buildBusinessActionInsight(
      'skipped', updated, updatedPosts,
      todayKey, [], businessServices, contentTypes,
    ));
    showActionMessage(`Skipped “${post.title}”. Kept in your record.`);
  };

  const handleWeekUploadInsights = () => {
    const previousWeekStart = shiftCalendarDays(visibleWeekStart, -7);
    setStatusMessage('');
    setSelectedWeeklyInsightsPostId('');
    setWeeklyInsightsContext({
      businessId: activeBusiness.id,
      startKey: formatDateInput(previousWeekStart),
      endKey: formatDateInput(shiftCalendarDays(previousWeekStart, 6)),
    });
  };

  const closeWeeklyInsightsPicker = () => {
    setWeeklyInsightsContext(null);
    setSelectedWeeklyInsightsPostId('');
  };

  const handleAddConversionSuggestion = () => {
    if (!selectedUserPost) return;
    const refreshed = buildConversionReview(selectedUserPost, activeBusinessPosts,
      formatDateInput(new Date()), [], businessServices);
    const proposal = refreshed.proposal;
    if (proposal && !contentTypes.includes(proposal.contentType)) {
      showActionMessage('This follow-up was skipped because its content type is not enabled for this business.');
      return;
    }
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
    const alreadyAdded = activeBusinessPosts.some((existing) =>
      existing.sourcePostId === suggestion.sourcePostId && existing.suggestionKind === suggestion.suggestionKind);
    if (!alreadyAdded) {
      setUserPosts((current) => current.some((existing) =>
        existing.businessId === activeBusiness.id
        && existing.sourcePostId === suggestion.sourcePostId
        && existing.suggestionKind === suggestion.suggestionKind)
        ? current : [...current, suggestion]);
      recordNotification({
        businessId: activeBusiness.id,
        dedupeKey: `plan-change:${activeBusiness.id}:${suggestion.id}:${suggestion.date}:${suggestion.contentType}`,
        icon: 'calendar',
        title: 'New suggestion added',
        subtitle: `${suggestion.contentType} for ${suggestion.project}, ${formatPostOptionDate(suggestion.date)} · Airtime balance updated`,
        kind: 'plan-change',
        action: {
          kind: 'calendar-post',
          label: 'View on calendar',
          postId: suggestion.id,
          date: suggestion.date,
        },
      });
    }
    setActionInsight(null);
    setSelectedPostId(null);
    revealDateInCalendar(suggestion.date);
    showActionMessage(`Added “${suggestion.title}” to the calendar.`);
  };

  const handleCreateBusiness = (input: BusinessSetupInput, firstMove?: FirstRunSetupInput): BusinessSetupResult => {
    const name = input.name.trim();
    if (!name) return { error: 'Enter a name for this business.' };
    if (businesses.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'A business with that name already exists.' };
    }
    if (!isBusinessAccent(input.accent)) return { error: 'Choose a tab accent.' };
    const serviceName = input.serviceName.trim();
    const selectedPlatforms = [...new Set(input.platforms.filter((platform) => defaultPlatformOptions.includes(platform)))];
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
    const nextContentSettings = {
      ...businessContentSettingsById,
      [businessId]: createBusinessContentSettings(selectedPlatforms, defaultPlatformOptions),
    };
    const serializedBusinesses = JSON.stringify(nextBusinesses.map(({ id, name: businessName, accent, platforms }) => ({
      id, name: businessName, accent, platforms,
    })));
    let startingPosts: UserPost[] | undefined;
    if (firstMove) {
      const firstPost: UserPost = {
        id: createPostId(), businessId, project: service.name,
        contentType: firstMove.contentType, title: `${firstMove.contentType} · ${service.name}`,
        date: firstMove.date, platforms: selectedPlatforms, distribution: 'organic',
        ...(firstMove.isCompleted ? { isCompleted: true, status: 'completed' as const } : {}),
      };
      const startingInsight = buildBusinessActionInsight(
        firstMove.isCompleted ? 'completed' : 'logged', firstPost, [firstPost],
        currentDateInput(), [], [service], nextContentSettings[businessId].contentTypes,
      );
      startingPosts = [firstPost, ...startingInsight.proposals.map((proposal): UserPost => ({
        id: createPostId(), businessId, project: service.name,
        contentType: proposal.contentType, title: proposal.title, date: proposal.date,
        platforms: selectedPlatforms, distribution: proposal.distribution ?? 'organic',
        schedulingStatus: 'approved-suggestion', sourcePostId: firstPost.id, suggestionKind: proposal.kind,
      }))];
    }
    try {
      writeLocalStorageBatch([
        [userBusinessesStorageKey, serializedBusinesses],
        [servicesStorageKey, JSON.stringify(nextServices)],
        [businessContentSettingsStorageKey, JSON.stringify(nextContentSettings)],
        ...(startingPosts ? [
          [userPostsStorageKey, JSON.stringify([...userPosts, ...startingPosts])],
          [activeBusinessStorageKey, businessId],
          [firstRunStorageKey, 'completed'],
        ] as Array<[string, string]> : []),
      ]);
    } catch {
      return { error: 'This business and its first Service or Campaign could not be saved on this device.' };
    }

    setUserBusinesses(nextBusinesses);
    setServices(nextServices);
    setBusinessContentSettingsById(nextContentSettings);
    if (startingPosts) {
      setUserPosts((current) => [...current, ...startingPosts!]);
      setActiveBusinessId(businessId);
      setCalendarView('month');
      revealDateInCalendar(startingPosts[0].date);
      setActionInsight(null);
      setSelectedPostId(null);
    }
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
    revealDateInCalendar(todayKey);
    setStatusMessage('');
    setActionInsight(null);
    setSelectedPostId(null);
    closePostForm();
    setIsServiceManagerOpen(false);
    setIsBusinessDialogOpen(false);
  };

  const handleRenameBusiness = (name: string): string | undefined => {
    const target = activeBusiness.id;
    if (!businesses.some((business) => business.id === target)) return 'Choose a business first.';
    const error = validateBusinessName(name, target, businesses);
    if (error) return error;
    const nextBusinesses = userBusinesses.map((business) =>
      business.id === target ? { ...business, name: name.trim() } : business);
    const nextOverrides = userBusinesses.some((business) => business.id === target)
      ? businessOverrides
      : { ...businessOverrides, [target]: { ...businessOverrides[target], name: name.trim() } };
    try {
      writeLocalStorageBatch([
        [userBusinessesStorageKey, JSON.stringify(nextBusinesses.map(({ id, name: businessName, accent, platforms }) =>
          ({ id, name: businessName, accent, platforms })))],
        [businessOverridesStorageKey, JSON.stringify(nextOverrides)],
      ]);
    } catch { return 'The new business name could not be saved. Please try again.'; }
    setUserBusinesses(nextBusinesses);
    setBusinessOverrides(nextOverrides);
    return undefined;
  };

  const handleDeleteBusiness = (): string | undefined => {
    const target = activeBusiness.id;
    if (!businesses.some((business) => business.id === target)) return 'Choose a business first.';
    const nextBusinesses = userBusinesses.filter((business) => business.id !== target);
    const nextServices = withoutBusiness(services, target);
    const nextPosts = withoutBusiness(userPosts, target);
    const nextNotifications = withoutBusiness(notifications, target);
    const nextSettings = withoutBusinessSettings(businessContentSettingsById, target);
    const nextSeasons = withoutBusinessSeasons(seasonMonthsByService, target);
    // Tombstones prevent legacy built-in workspaces from reappearing on reload.
    const nextOverrides = { ...businessOverrides, [target]: { deleted: true } };
    const nextActiveId = businesses.find((business) => business.id !== target)?.id ?? emptyWorkspace.id;
    try {
      writeLocalStorageBatch([
        [userBusinessesStorageKey, JSON.stringify(nextBusinesses.map(({ id, name, accent, platforms }) =>
          ({ id, name, accent, platforms })))],
        [servicesStorageKey, JSON.stringify(nextServices)],
        [userPostsStorageKey, JSON.stringify(nextPosts)],
        [notificationsStorageKey, JSON.stringify(nextNotifications)],
        [businessContentSettingsStorageKey, JSON.stringify(nextSettings)],
        [serviceSeasonsStorageKey, JSON.stringify(nextSeasons)],
        [businessOverridesStorageKey, JSON.stringify(nextOverrides)],
        [activeBusinessStorageKey, nextActiveId],
      ]);
    } catch { return 'The business could not be deleted. Nothing was changed. Please try again.'; }
    setUserBusinesses(nextBusinesses);
    setServices(nextServices);
    setUserPosts(nextPosts);
    setNotifications(nextNotifications);
    setBusinessContentSettingsById(nextSettings);
    setSeasonMonthsByService(nextSeasons);
    setBusinessOverrides(nextOverrides);
    setActiveBusinessId(nextActiveId);
    setIsBusinessManagerOpen(false);
    setIsServiceManagerOpen(false);
    setIsContentManagerOpen(false);
    setIsBusinessDialogOpen(false);
    setActionInsight(null);
    setSelectedPostId(null);
    setWeeklyInsightsContext(null);
    setSelectedWeeklyInsightsPostId('');
    closePostForm();
    setStatusMessage('');
    return undefined;
  };

  const openBusinessAction = (businessId: string, action: 'edit' | 'delete') => {
    setActiveBusinessId(businessId);
    setBusinessManagerAction(action);
    setStatusMessage('');
    setActionInsight(null);
    closeSelectedPost();
    closePostForm();
    setIsServiceManagerOpen(false);
    setIsContentManagerOpen(false);
    setIsBusinessDialogOpen(false);
    setIsBusinessManagerOpen(true);
  };

  if (needsSetup) {
    return <FirstRunSetup
      platformOptions={defaultPlatformOptions}
      contentTypes={defaultContentTypes}
      today={currentDateInput()}
      onComplete={(input) => {
        const error = validateFirstRun(input, defaultPlatformOptions, defaultContentTypes, currentDateInput());
        if (error) return error;
        const result = handleCreateBusiness({
          name: input.businessName, accent: 'rose', serviceName: input.serviceName,
          mode: input.mode, startDate: input.date < currentDateInput() ? input.date : currentDateInput(),
          deadline: input.deadline, platforms: input.platforms,
        }, input);
        return 'error' in result ? result.error : undefined;
      }}
      onSkip={() => {
        try { window.localStorage.setItem(firstRunStorageKey, 'skipped'); }
        catch { return 'Setup could not be saved on this device. Please try again.'; }
        setCalendarView('month');
        finishSetup();
        return undefined;
      }}
      onEnterCalendar={finishSetup}
    />;
  }

  return (
    <main className="calendar-page">
      <div className="calendar-shell">
        <div className="business-switcher">
          <nav className="business-tabs" aria-label="Businesses">
            {businesses.map((business) => (
              <ContextMenu key={business.id} modal={false}>
                <ContextMenuTrigger asChild>
              <button
                aria-pressed={business.id === activeBusiness.id}
                className={`business-tab ${business.id === activeBusiness.id ? 'active' : ''}`}
                title="Right-click to edit or delete this business"
                style={{ '--business-accent-color': getBusinessAccent(business.accent).color } as CSSProperties}
                onClick={() => {
                  setActiveBusinessId(business.id);
                  setStatusMessage('');
                  setActionInsight(null);
                  closeSelectedPost();
                  closePostForm();
                  setIsServiceManagerOpen(false);
                  setIsContentManagerOpen(false);
                  setIsBusinessManagerOpen(false);
                }}
                type="button"
              >
                <span className="business-dot" aria-hidden="true" />
                {business.name}
              </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="business-tab-menu" aria-label={`Options for ${business.name}`}>
                  <ContextMenuItem className="business-tab-menu-item"
                    onSelect={() => openBusinessAction(business.id, 'edit')}>Edit</ContextMenuItem>
                  <ContextMenuItem className="business-tab-menu-item business-tab-menu-delete"
                    onSelect={() => openBusinessAction(business.id, 'delete')}>Delete</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            <button
              aria-label="Add a business"
              className="business-tab business-tab-add"
              onClick={() => {
                setActionInsight(null);
                closeSelectedPost();
                closePostForm();
                setIsContentManagerOpen(false);
                setIsBusinessDialogOpen(true);
              }}
              type="button"
            >
              <Plus size={17} strokeWidth={1.7} />
            </button>
          </nav>
          <NotificationCenter
            key={activeBusiness.id}
            businessName={activeBusiness.name}
            notifications={activeNotifications}
            unreadCount={unreadNotificationCount}
            onOpened={markActiveNotificationsRead}
            onDismiss={dismissActiveNotification}
            onClearAll={clearActiveNotifications}
            onActivate={handleOpenNotification}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
          />
        </div>
        {campaignWakeupBanners.length > 0 && (
          <div className="campaign-wakeup-stack">
            {campaignWakeupBanners.map((notification) => (
              <CampaignWakeupBanner
                key={notification.id}
                notification={notification}
                onYes={handleOpenNotification}
                onNotNow={dismissCampaignWakeupBanner}
                onDismiss={dismissCampaignWakeupBanner}
              />
            ))}
          </div>
        )}

        <header className="calendar-header">
          <div>
            <p className="calendar-kicker">{calendarView === 'week' ? 'Weekly' : 'Monthly'} workspace</p>
            <h1 className="calendar-title">
              {monthFormatter.format(calendarDisplayMonth).split(' ')[0]} <em>{calendarDisplayMonth.getFullYear()}</em>
            </h1>
            <p className="calendar-subtitle">{activeBusiness.descriptor} {activeBusiness.focus}</p>
          </div>
          <div className="header-actions">
            <button className="icon-button manage-services" onClick={() =>
              activeBusiness.id === emptyWorkspace.id ? setIsBusinessDialogOpen(true) : setIsServiceManagerOpen(true)} type="button">
              <Settings2 size={15} strokeWidth={1.8} aria-hidden="true" />
              Manage services
            </button>
            <button className="icon-button manage-content" onClick={() =>
              activeBusiness.id === emptyWorkspace.id ? setIsBusinessDialogOpen(true) : setIsContentManagerOpen(true)} type="button">
              <Settings2 size={15} strokeWidth={1.8} aria-hidden="true" />
              Manage content
            </button>
            {calendarView === 'month' && <div className="month-nav" aria-label="Change month">
              <button aria-label="Previous month" className="icon-button" onClick={() => shiftMonth(-1)} type="button">
                <ChevronLeft size={18} strokeWidth={1.7} />
              </button>
              <span className="month-nav-label">{monthFormatter.format(visibleMonth)}</span>
              <button aria-label="Next month" className="icon-button" onClick={() => shiftMonth(1)} type="button">
                <ChevronRight size={18} strokeWidth={1.7} />
              </button>
            </div>}
            <button className="add-post" onClick={() => openPostForm()} type="button">
              <Plus size={15} strokeWidth={2.2} />
              Add post
            </button>
          </div>
        </header>

        <div className="calendar-toolbar">
          <p className="toolbar-note">
            <strong>{calendarView === 'week' ? weekCalendarItems.length : calendarEvents.length} planned moments</strong> · {activeBusiness.name}
          </p>
          <div className="view-toggle" aria-label="Calendar view">
            <button
              className={`view-option${calendarView === 'month' ? ' active' : ''}`}
              aria-pressed={calendarView === 'month'}
              data-testid="button-calendar-month"
              onClick={() => selectCalendarView('month')}
              type="button"
            >Month</button>
            <button
              className={`view-option${calendarView === 'week' ? ' active' : ''}`}
              aria-pressed={calendarView === 'week'}
              data-testid="button-calendar-week"
              onClick={() => selectCalendarView('week')}
              type="button"
            >
              Week
            </button>
          </div>
        </div>

        <div className={`content-layout${calendarView === 'week' ? ' week-layout' : ''}`}>
          {calendarView === 'week' ? (
            <WeekCalendarView
              weekStart={visibleWeekStart}
              items={weekCalendarItems}
              midCampaignCheckIns={midCampaignCheckIns}
              todayKey={todayKey}
              onPreviousWeek={() => setVisibleWeekStart((current) => shiftCalendarDays(current, -7))}
              onNextWeek={() => setVisibleWeekStart((current) => shiftCalendarDays(current, 7))}
              onAddPost={() => openPostForm()}
              onOpenPost={setSelectedPostId}
              onToggleComplete={handleTogglePostCompletion}
              onSkipPost={handleSkipPost}
              completedCount={weekCalendarItems.filter((item) => item.id && item.isCompleted).length}
              totalMoves={weekCalendarItems.filter((item) => item.id).length}
              onUploadInsights={handleWeekUploadInsights}
              onUploadMidCampaignInsights={(postId) => {
                setStatusMessage('');
                setSelectedPostId(postId);
              }}
            />
          ) : <section aria-label={`${monthFormatter.format(visibleMonth)} content calendar`} className="calendar-card">
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
                        const colorClass = event.contentTypeName ? 'event-content-type' : `event-${event.tone}`;
                        const colorStyle = event.contentTypeName ? getContentTypeStyle(event.contentTypeName) : undefined;
                        const eventContent = (
                          <>
                            <span className={event.isCompleted ? 'event-title-completed' : undefined}>
                              {event.title}
                            </span>
                            {event.detail && <small>{event.detail}</small>}
                            {event.isCompleted && (
                              <span className="event-post-status" aria-label="Done">
                                <Check size={11} aria-hidden="true" /> Done
                              </span>
                            )}
                            {event.isSkipped && <span className="event-post-status event-post-skipped" aria-label="Skipped">Skipped</span>}
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
                            className={`event-chip event-chip-button ${colorClass}${event.isCompleted ? ' event-chip-completed' : ''}${event.isSkipped ? ' event-chip-skipped' : ''}`}
                            key={`${event.id}-${event.day}-${event.title}`}
                            onClick={() => setSelectedPostId(event.id ?? null)}
                            style={colorStyle}
                            title="Select to view or delete this saved post"
                            type="button"
                          >
                            {eventContent}
                          </button>
                        ) : (
                          <div
                            className={`event-chip ${colorClass}`}
                            key={`${event.day}-${event.title}`}
                            style={colorStyle}
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
          </section>}

          {calendarView === 'month' && <aside className="sidebar">
            <section className="insight-card tint">
              <p className="insight-eyebrow">This month at a glance</p>
              <h2>Keep the signal warm.</h2>
              <p>{activeBusiness.focus}</p>
              <MonthlyAirtimeBars
                rows={monthlyAirtime}
                businessId={activeBusiness.id}
                getTone={(service) => getPostTone(service, activeBusiness)}
                month={calendarDisplayMonth.getMonth() + 1}
                seasonMonthsByService={seasonMonthsByService}
                onSaveSeasonMonths={handleSaveSeasonMonths}
              />
            </section>

            <section className="insight-card">
              <p className="legend-title">Content types</p>
              <div className="legend">
                {contentTypes.map((contentType) => (
                  <div className="legend-item" key={contentType}>
                    <span className="legend-swatch content-type-swatch" style={getContentTypeStyle(contentType)} />
                    {contentType}
                  </div>
                ))}
              </div>
              <p className="legend-title service-legend-title">Services &amp; campaigns</p>
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
          </aside>}
          {calendarView === 'week' && statusMessage && (
            <p className="calendar-status" role="status">{statusMessage}</p>
          )}
        </div>

        {isServiceManagerOpen && (
          <ServiceManager
            services={businessServices}
            onCloseCampaign={handleCloseCampaign}
            onDismissWakeMatch={dismissCampaignNameMatch}
            today={todayKey}
            businessId={activeBusiness.id}
            businessName={activeBusiness.name}
            platformOptions={availablePlatforms}
            defaultPlatforms={activeBusiness.platforms}
            onSave={handleSaveService}
            onClose={() => setIsServiceManagerOpen(false)}
          />
        )}
        {isBusinessManagerOpen && (
          <BusinessManager
            key={`${activeBusiness.id}-${businessManagerAction}`}
            initialAction={businessManagerAction}
            businessName={activeBusiness.name}
            serviceCount={businessServices.length}
            postCount={activeBusinessPosts.length}
            onRename={handleRenameBusiness}
            onDelete={handleDeleteBusiness}
            onClose={() => setIsBusinessManagerOpen(false)}
          />
        )}
        {isContentManagerOpen && (
          <BusinessContentManager
            businessName={activeBusiness.name}
            contentTypes={contentTypes}
            platforms={availablePlatforms}
            onAdd={(kind, name) => updateBusinessContentCatalog(kind, 'add', name, name)}
            onRename={(kind, oldName, newName) => updateBusinessContentCatalog(kind, 'rename', oldName, newName)}
            onDelete={(kind, name) => updateBusinessContentCatalog(kind, 'delete', name)}
            onClose={() => setIsContentManagerOpen(false)}
          />
        )}
        {isBusinessDialogOpen && (
          <BusinessDialog
            platformOptions={defaultPlatformOptions}
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
                    <button
                      className="platform-add-option"
                      onClick={() => setIsContentManagerOpen(true)}
                      type="button"
                    >
                      <Settings2 size={14} strokeWidth={1.8} />
                      Manage content types &amp; platforms
                    </button>
                  </div>
                  <p className="platform-note">Options are saved separately for {activeBusiness.name}.</p>
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
                  <div><span>Status</span><strong>{selectedUserPost.status === 'skipped' ? 'Skipped' : selectedUserPost.isCompleted ? 'Done' : 'Planned'}</strong></div>
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
                    <strong>{selectedUserPost.contentType || '—'}</strong>
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
                    activeBusinessPosts,
                    todayKey,
                    businessServices,
                  )}</p>
                </section>
                <p className="post-detail-note">Deleting removes this saved post from the calendar.</p>
                <div className="post-detail-actions">
                  <button
                    aria-label={selectedUserPost.isCompleted ? 'Mark post not done' : 'Mark post done'}
                    className={selectedUserPost.isCompleted ? 'cancel-button' : 'post-status-complete'}
                    onClick={() => handleTogglePostCompletion(selectedUserPost.id, !selectedUserPost.isCompleted)}
                    type="button"
                  >
                    {selectedUserPost.isCompleted ? 'Mark not done' : 'Mark done'}
                  </button>
                  <button
                    aria-label={selectedUserPost.status === 'skipped' ? 'Undo skip post' : 'Skip post'}
                    className="post-status-skipped"
                    onClick={() => handleSkipPost(selectedUserPost.id)}
                    type="button"
                  >
                    {selectedUserPost.status === 'skipped' ? 'Undo skip' : 'Skip'}
                  </button>
                  <button className="delete-post-button" onClick={handleDeletePost} type="button">Delete post</button>
                </div>
              </div>
            </section>
          </div>
        )}
        {weeklyInsightsContext?.businessId === activeBusiness.id && (
          <div
            className="post-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeWeeklyInsightsPicker();
            }}
            role="presentation"
          >
            <section
              aria-labelledby="weekly-insights-title"
              aria-modal="true"
              className="post-modal weekly-insights-modal"
              role="dialog"
            >
              <div className="post-modal-header">
                <div>
                  <p className="post-modal-kicker">Weekly check-in · {activeBusiness.name}</p>
                  <h2 id="weekly-insights-title">Upload last week’s insights</h2>
                  <p className="post-modal-intro">
                    Posts from {formatPostOptionDate(weeklyInsightsContext.startKey)} – {formatPostOptionDate(weeklyInsightsContext.endKey)}. Choose a post, then add its results.
                  </p>
                </div>
                <button
                  aria-label="Close weekly insights"
                  className="modal-close"
                  onClick={closeWeeklyInsightsPicker}
                  type="button"
                >
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>
              <div className="post-detail-body">
                <label className="form-field weekly-insights-post-picker">
                  <span>Post from the previous week</span>
                  <select
                    aria-label="Choose a previous-week post"
                    data-testid="select-weekly-insights-post"
                    onChange={(event) => setSelectedWeeklyInsightsPostId(event.target.value)}
                    value={selectedWeeklyInsightsPostId}
                  >
                    <option value="">Choose a post…</option>
                    {weeklyInsightsPosts.map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.project} · {post.contentType || 'Content type not set'} · {post.platforms.join(', ') || 'No platform'} · {formatPostOptionDate(post.date)} — {post.title}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedWeeklyInsightsPost ? (
                  <PostPerformanceForm
                    key={selectedWeeklyInsightsPost.id}
                    performance={selectedWeeklyInsightsPost.performance}
                    postedTime={selectedWeeklyInsightsPost.postedTime}
                    onSave={(performance, postedTime) => handleSaveResultsForPost(
                      selectedWeeklyInsightsPost,
                      performance,
                      postedTime,
                    )}
                  />
                ) : weeklyInsightsPosts.length > 0 ? (
                  <p className="weekly-insights-hint">Select a post above to enter its results. You can choose another post here after saving.</p>
                ) : (
                  <p className="weekly-insights-hint">No saved posts were found in the week before this one.</p>
                )}
                <div className="post-form-actions">
                  <button className="cancel-button" onClick={closeWeeklyInsightsPicker} type="button">Close</button>
                </div>
              </div>
            </section>
          </div>
        )}
        {actionInsight && (
          <ActionInsightPopup
            insight={actionInsight}
            onAdd={handleAddInsightSuggestions}
            onDismiss={handleDismissActionInsight}
            onSkip={() => actionInsight.proposals.length > 0
              ? keepPerformanceInsight(actionInsight)
              : setActionInsight(null)}
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
          <WelcomeEntry sampleServiceIds={legacySampleServiceIds}>
            <Router />
          </WelcomeEntry>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

